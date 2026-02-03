import pool, { query } from '../config/database';
import { hybridDataService } from './hybridDataService';
import { getFirestore } from '../config/firebase';
import UserService from './userService';
import * as admin from 'firebase-admin';

// ============================================
// INTERFACES
// ============================================

export interface SignalementLocation {
    latitude: number;
    longitude: number;
}

export interface Signalement {
    id_signalement: number;
    location: SignalementLocation | null;
    description?: string;
    date_signalement: Date;
    firebase_id?: string;
    est_synchronise: boolean;
    id_user: number;
    id_status: number;
}

export interface CreateSignalementDTO {
    latitude: number;
    longitude: number;
    description?: string;
    firebase_uid: string;  // UID Firebase de l'utilisateur
}

export interface UpdateSignalementDTO {
    description?: string;
    latitude?: number;
    longitude?: number;
}

export interface SignalementWithDetails extends Signalement {
    status_libelle?: string;
    status_couleur?: string;
    user_display_name?: string;
    user_email?: string;
    reparation?: {
        id_reparation: number;
        surface_m2: number;
        budget: number;
        date_debut?: Date;
        date_fin_prevue?: Date;
        date_fin_reelle?: Date;
        commentaire?: string;
        entreprise_nom?: string;
        entreprise_tel?: string;
    } | null;
}

// ============================================
// SERVICE SIGNALEMENT
// ============================================

export class SignalementService {

    /**
     * Crée un nouveau signalement
     * - Mode online: PostgreSQL + Firebase
     * - Mode offline: PostgreSQL uniquement (à synchroniser plus tard)
     */
    static async create(data: CreateSignalementDTO): Promise<Signalement> {
        const isOnline = await hybridDataService.isFirebaseAvailable();

        // Récupérer l'id_user PostgreSQL à partir du firebase_uid
        const user = await UserService.findByFirebaseUid(data.firebase_uid);
        if (!user) {
            throw new Error('Utilisateur non trouvé avec ce firebase_uid');
        }
        const id_user = user.id_user;

        // Créer dans PostgreSQL
        const result = await query(
            `INSERT INTO Signalement (location, description, id_user, id_status, est_synchronise)
       VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, 1, $5)
       RETURNING id_signalement, 
                 ST_X(location) as longitude, 
                 ST_Y(location) as latitude,
                 description, date_signalement, firebase_id, est_synchronise, id_user, id_status`,
            [
                data.longitude,
                data.latitude,
                data.description || null,
                id_user,
                isOnline // est_synchronise = true si online
            ]
        );

        const signalement = this.mapRowToSignalement(result.rows[0]);

        // Si online, synchroniser avec Firebase
        if (isOnline) {
            try {
                const db = getFirestore();
                const docRef = await db.collection('signalements').add({
                    location: new admin.firestore.GeoPoint(data.latitude, data.longitude),
                    description: data.description || null,
                    firebase_uid: data.firebase_uid,  // Stocker le firebase_uid dans Firebase
                    id_user: id_user,
                    id_status: 1,
                    date_signalement: admin.firestore.FieldValue.serverTimestamp(),
                    postgres_id: signalement.id_signalement
                });

                // Mettre à jour le firebase_id dans PostgreSQL
                await query(
                    `UPDATE Signalement SET firebase_id = $1, est_synchronise = TRUE 
           WHERE id_signalement = $2`,
                    [docRef.id, signalement.id_signalement]
                );

                signalement.firebase_id = docRef.id;
                signalement.est_synchronise = true;
                console.log(`✅ Signalement ${signalement.id_signalement} synchronisé avec Firebase (${docRef.id})`);
            } catch (error) {
                console.warn('⚠️ Erreur sync Firebase (PostgreSQL OK):', (error as Error).message);
            }
        } else {
            console.log(`💾 Signalement ${signalement.id_signalement} créé en mode offline (à synchroniser)`);
        }

        return signalement;
    }

    /**
     * Récupère tous les signalements avec leurs détails
     */
    static async findAll(filters?: {
        status?: number;
        userId?: number;
        dateDebut?: string;
        dateFin?: string;
    }): Promise<SignalementWithDetails[]> {
        let queryText = `
      SELECT 
        s.id_signalement,
        ST_X(s.location) as longitude,
        ST_Y(s.location) as latitude,
        s.description,
        s.date_signalement,
        s.firebase_id,
        s.est_synchronise,
        s.id_user,
        s.id_status,
        st.libelle as status_libelle,
        st.couleur as status_couleur,
        u.display_name as user_display_name,
        u.email as user_email,
        r.id_reparation,
        r.surface_m2,
        r.budget,
        r.date_debut,
        r.date_fin_prevue,
        r.date_fin_reelle,
        r.commentaire as reparation_commentaire,
        e.nom as entreprise_nom,
        e.telephone as entreprise_tel
      FROM Signalement s
      JOIN Status st ON s.id_status = st.id_status
      JOIN User_ u ON s.id_user = u.id_user
      LEFT JOIN Reparation r ON s.id_signalement = r.id_signalement
      LEFT JOIN Entreprise e ON r.id_entreprise = e.id_entreprise
      WHERE 1=1
    `;

        const params: any[] = [];
        let paramIndex = 1;

        if (filters?.status) {
            queryText += ` AND s.id_status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        if (filters?.userId) {
            queryText += ` AND s.id_user = $${paramIndex}`;
            params.push(filters.userId);
            paramIndex++;
        }

        if (filters?.dateDebut) {
            queryText += ` AND s.date_signalement >= $${paramIndex}`;
            params.push(filters.dateDebut);
            paramIndex++;
        }

        if (filters?.dateFin) {
            queryText += ` AND s.date_signalement <= $${paramIndex}`;
            params.push(filters.dateFin);
            paramIndex++;
        }

        queryText += ' ORDER BY s.date_signalement DESC';

        const result = await query(queryText, params);
        return result.rows.map(row => this.mapRowToSignalementWithDetails(row));
    }

    /**
     * Récupère un signalement par son ID
     */
    static async findById(id: number): Promise<SignalementWithDetails | null> {
        const result = await query(
            `SELECT 
        s.id_signalement,
        ST_X(s.location) as longitude,
        ST_Y(s.location) as latitude,
        s.description,
        s.date_signalement,
        s.firebase_id,
        s.est_synchronise,
        s.id_user,
        s.id_status,
        st.libelle as status_libelle,
        st.couleur as status_couleur,
        u.display_name as user_display_name,
        u.email as user_email,
        r.id_reparation,
        r.surface_m2,
        r.budget,
        r.date_debut,
        r.date_fin_prevue,
        r.date_fin_reelle,
        r.commentaire as reparation_commentaire,
        e.nom as entreprise_nom,
        e.telephone as entreprise_tel
      FROM Signalement s
      JOIN Status st ON s.id_status = st.id_status
      JOIN User_ u ON s.id_user = u.id_user
      LEFT JOIN Reparation r ON s.id_signalement = r.id_signalement
      LEFT JOIN Entreprise e ON r.id_entreprise = e.id_entreprise
      WHERE s.id_signalement = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return this.mapRowToSignalementWithDetails(result.rows[0]);
    }

    /**
     * Récupère les signalements d'un utilisateur
     */
    static async findByUserId(userId: number): Promise<SignalementWithDetails[]> {
        return this.findAll({ userId });
    }

    /**
     * Met à jour un signalement
     * Seul l'utilisateur qui a créé le signalement peut le modifier
     * Et seulement si le statut est encore "Nouveau" (pas de réparation en cours)
     */
    static async update(id: number, userId: number, data: UpdateSignalementDTO): Promise<Signalement | null> {
        // Vérifier que le signalement appartient à l'utilisateur et est modifiable
        const checkResult = await query(
            `SELECT s.id_signalement, s.id_user, s.id_status, st.libelle as status_libelle
       FROM Signalement s
       JOIN Status st ON s.id_status = st.id_status
       WHERE s.id_signalement = $1`,
            [id]
        );

        if (checkResult.rows.length === 0) {
            return null;
        }

        const existing = checkResult.rows[0];

        if (existing.id_user !== userId) {
            throw new Error('UNAUTHORIZED: Vous ne pouvez modifier que vos propres signalements');
        }

        if (existing.status_libelle?.toLowerCase() !== 'nouveau') {
            throw new Error('LOCKED: Ce signalement ne peut plus être modifié car il est en cours de traitement');
        }

        // Construire la requête de mise à jour
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (data.description !== undefined) {
            updates.push(`description = $${paramIndex}`);
            values.push(data.description);
            paramIndex++;
        }

        if (data.latitude !== undefined && data.longitude !== undefined) {
            updates.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)`);
            values.push(data.longitude, data.latitude);
            paramIndex += 2;
        }

        if (updates.length === 0) {
            return this.findById(id);
        }

        // Marquer comme non synchronisé car modifié
        updates.push(`est_synchronise = FALSE`);

        values.push(id);

        const result = await query(
            `UPDATE Signalement SET ${updates.join(', ')} 
       WHERE id_signalement = $${paramIndex}
       RETURNING id_signalement, 
                 ST_X(location) as longitude, 
                 ST_Y(location) as latitude,
                 description, date_signalement, firebase_id, est_synchronise, id_user, id_status`,
            values
        );

        const signalement = this.mapRowToSignalement(result.rows[0]);

        // Synchroniser avec Firebase si online
        await this.syncToFirebase(signalement);

        return signalement;
    }

    /**
     * Supprime un signalement
     * Seul l'utilisateur qui a créé le signalement peut le supprimer
     * Et seulement si le statut est encore "Nouveau"
     */
    static async delete(id: number, userId: number): Promise<boolean> {
        // Vérifier que le signalement appartient à l'utilisateur et est supprimable
        const checkResult = await query(
            `SELECT s.id_signalement, s.id_user, s.firebase_id, st.libelle as status_libelle
       FROM Signalement s
       JOIN Status st ON s.id_status = st.id_status
       WHERE s.id_signalement = $1`,
            [id]
        );

        if (checkResult.rows.length === 0) {
            return false;
        }

        const existing = checkResult.rows[0];

        if (existing.id_user !== userId) {
            throw new Error('UNAUTHORIZED: Vous ne pouvez supprimer que vos propres signalements');
        }

        if (existing.status_libelle?.toLowerCase() !== 'nouveau') {
            throw new Error('LOCKED: Ce signalement ne peut plus être supprimé car il est en cours de traitement');
        }

        // Supprimer de PostgreSQL
        await query('DELETE FROM Signalement WHERE id_signalement = $1', [id]);

        // Supprimer de Firebase si existe
        if (existing.firebase_id) {
            try {
                const isOnline = await hybridDataService.isFirebaseAvailable();
                if (isOnline) {
                    const db = getFirestore();
                    await db.collection('signalements').doc(existing.firebase_id).delete();
                    console.log(`✅ Signalement supprimé de Firebase: ${existing.firebase_id}`);
                }
            } catch (error) {
                console.warn('⚠️ Erreur suppression Firebase:', (error as Error).message);
            }
        }

        console.log(`✅ Signalement ${id} supprimé`);
        return true;
    }

    /**
     * Récupère les statistiques des signalements
     */
    static async getStats(): Promise<{
        total: number;
        par_status: { libelle: string; count: number; couleur: string }[];
        surface_totale: number;
        budget_total: number;
        avancement_pct: number;
    }> {
        const statsResult = await query(`
      SELECT 
        (SELECT COUNT(*) FROM Signalement) as total,
        (SELECT COALESCE(SUM(surface_m2), 0) FROM Reparation) as surface_totale,
        (SELECT COALESCE(SUM(budget), 0) FROM Reparation) as budget_total,
        (SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(CASE WHEN date_fin_reelle IS NOT NULL THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2)
          END
         FROM Reparation) as avancement_pct
    `);

        const statusResult = await query(`
      SELECT st.libelle, st.couleur, COUNT(s.id_signalement) as count
      FROM Status st
      LEFT JOIN Signalement s ON st.id_status = s.id_status
      GROUP BY st.id_status, st.libelle, st.couleur
      ORDER BY st.id_status
    `);

        const stats = statsResult.rows[0];

        return {
            total: parseInt(stats.total),
            par_status: statusResult.rows.map(row => ({
                libelle: row.libelle,
                count: parseInt(row.count),
                couleur: row.couleur
            })),
            surface_totale: parseFloat(stats.surface_totale),
            budget_total: parseFloat(stats.budget_total),
            avancement_pct: parseFloat(stats.avancement_pct)
        };
    }

    /**
     * Récupère les signalements non synchronisés
     */
    static async getPendingSync(): Promise<Signalement[]> {
        const result = await query(
            `SELECT id_signalement, 
              ST_X(location) as longitude, 
              ST_Y(location) as latitude,
              description, date_signalement, firebase_id, est_synchronise, id_user, id_status
       FROM Signalement 
       WHERE est_synchronise = FALSE
       ORDER BY date_signalement ASC`
        );

        return result.rows.map(row => this.mapRowToSignalement(row));
    }

    /**
     * Synchronise les signalements en attente avec Firebase
     */
    static async syncPendingToFirebase(): Promise<{ synced: number; errors: number }> {
        const isOnline = await hybridDataService.isFirebaseAvailable();

        if (!isOnline) {
            console.log('❌ Synchronisation impossible: Firebase non disponible');
            return { synced: 0, errors: 0 };
        }

        const pending = await this.getPendingSync();
        let synced = 0;
        let errors = 0;

        console.log(`📡 Synchronisation de ${pending.length} signalements...`);

        for (const signalement of pending) {
            try {
                await this.syncToFirebase(signalement);
                synced++;
            } catch (error) {
                console.error(`❌ Erreur sync signalement ${signalement.id_signalement}:`, error);
                errors++;
            }
        }

        console.log(`✅ Synchronisation terminée: ${synced} succès, ${errors} erreurs`);
        return { synced, errors };
    }

    /**
     * Synchronise un signalement individuel avec Firebase
     */
    private static async syncToFirebase(signalement: Signalement): Promise<void> {
        const isOnline = await hybridDataService.isFirebaseAvailable();

        if (!isOnline) {
            return;
        }

        try {
            const db = getFirestore();
            const data = {
                location: signalement.location
                    ? new admin.firestore.GeoPoint(signalement.location.latitude, signalement.location.longitude)
                    : null,
                description: signalement.description || null,
                id_user: signalement.id_user,
                id_status: signalement.id_status,
                date_signalement: signalement.date_signalement,
                postgres_id: signalement.id_signalement,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            };

            if (signalement.firebase_id) {
                // Mettre à jour
                await db.collection('signalements').doc(signalement.firebase_id).update(data);
            } else {
                // Créer
                const docRef = await db.collection('signalements').add({
                    ...data,
                    created_at: admin.firestore.FieldValue.serverTimestamp()
                });
                signalement.firebase_id = docRef.id;
            }

            // Marquer comme synchronisé avec la date de dernière sync
            await query(
                `UPDATE Signalement 
                 SET firebase_id = $1, est_synchronise = TRUE, derniere_sync = CURRENT_TIMESTAMP 
                 WHERE id_signalement = $2`,
                [signalement.firebase_id, signalement.id_signalement]
            );

            console.log(`✅ Signalement ${signalement.id_signalement} synchronisé`);
        } catch (error) {
            console.warn('⚠️ Erreur sync Firebase:', (error as Error).message);
            throw error;
        }
    }

    /**
     * Synchronisation bidirectionnelle complète (PostgreSQL <-> Firebase)
     * - Envoie les données locales vers Firebase
     * - Récupère les données de Firebase vers PostgreSQL
     */
    static async syncBidirectional(): Promise<{
        toFirebase: { signalements: number; reparations: number; historiques: number; errors: number };
        fromFirebase: { signalements: number; reparations: number; historiques: number; errors: number };
    }> {
        const isOnline = await hybridDataService.isFirebaseAvailable();

        if (!isOnline) {
            console.log('❌ Synchronisation impossible: Firebase non disponible');
            return {
                toFirebase: { signalements: 0, reparations: 0, historiques: 0, errors: 0 },
                fromFirebase: { signalements: 0, reparations: 0, historiques: 0, errors: 0 }
            };
        }

        console.log('🔄 Démarrage synchronisation bidirectionnelle...');

        // 1. Sync PostgreSQL -> Firebase
        const toFirebase = await this.syncToFirebaseAll();

        // 2. Sync Firebase -> PostgreSQL
        const fromFirebase = await this.syncFromFirebaseAll();

        console.log('✅ Synchronisation bidirectionnelle terminée');

        return { toFirebase, fromFirebase };
    }

    /**
     * Synchronise toutes les données locales vers Firebase
     */
    private static async syncToFirebaseAll(): Promise<{ signalements: number; reparations: number; historiques: number; errors: number }> {
        let signalementsSynced = 0;
        let reparationsSynced = 0;
        let historiquesSynced = 0;
        let errors = 0;

        try {
            const db = getFirestore();

            // 1. Synchroniser les signalements non synchronisés
            const pendingSignalements = await this.getPendingSync();
            console.log(`📤 ${pendingSignalements.length} signalements à envoyer vers Firebase`);

            for (const signalement of pendingSignalements) {
                try {
                    await this.syncToFirebase(signalement);
                    signalementsSynced++;
                } catch (error) {
                    console.error(`❌ Erreur sync signalement ${signalement.id_signalement}:`, error);
                    errors++;
                }
            }

            // 2. Synchroniser les réparations NON SYNCHRONISÉES
            const reparationsResult = await query(`
                SELECT r.*, s.firebase_id as signalement_firebase_id
                FROM Reparation r
                JOIN Signalement s ON r.id_signalement = s.id_signalement
                WHERE r.est_synchronise = FALSE OR r.est_synchronise IS NULL
            `);

            console.log(`📤 ${reparationsResult.rows.length} réparations à synchroniser vers Firebase`);

            for (const rep of reparationsResult.rows) {
                try {
                    const reparationData = {
                        id_reparation: rep.id_reparation,
                        id_signalement: rep.id_signalement,
                        signalement_firebase_id: rep.signalement_firebase_id,
                        surface_m2: rep.surface_m2 || 0,
                        budget: rep.budget || 0,
                        id_entreprise: rep.id_entreprise,
                        id_status: rep.id_status,
                        date_debut: rep.date_debut || null,
                        date_fin_prevue: rep.date_fin_prevue || null,
                        date_fin_reelle: rep.date_fin_reelle || null,
                        commentaire: rep.commentaire || null,
                        id_user: rep.id_user,
                        updated_at: admin.firestore.FieldValue.serverTimestamp()
                    };

                    const docRef = db.collection('reparations').doc(rep.id_reparation.toString());
                    const docSnapshot = await docRef.get();

                    if (docSnapshot.exists) {
                        await docRef.update(reparationData);
                    } else {
                        await docRef.set({
                            ...reparationData,
                            created_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    // Marquer comme synchronisé dans PostgreSQL
                    await query(
                        `UPDATE Reparation 
                         SET est_synchronise = TRUE, 
                             firebase_id = $1,
                             derniere_sync = CURRENT_TIMESTAMP 
                         WHERE id_reparation = $2`,
                        [rep.id_reparation.toString(), rep.id_reparation]
                    );

                    reparationsSynced++;
                } catch (error) {
                    console.error(`❌ Erreur sync réparation ${rep.id_reparation}:`, error);
                    errors++;
                }
            }

            // 3. Synchroniser l'historique des statuts
            const historiquesResult = await query(`
                SELECT h.*, r.id_signalement
                FROM HistoriqueStatus h
                JOIN Reparation r ON h.id_reparation = r.id_reparation
                ORDER BY h.date_modification ASC
            `);

            console.log(`📤 ${historiquesResult.rows.length} historiques de status à synchroniser vers Firebase`);

            for (const hist of historiquesResult.rows) {
                try {
                    const historiqueData = {
                        id_historique: hist.id_historique,
                        id_reparation: hist.id_reparation,
                        id_signalement: hist.id_signalement,
                        id_status_ancien: hist.id_status_ancien || null,
                        id_status_nouveau: hist.id_status_nouveau,
                        id_user: hist.id_user,
                        date_modification: hist.date_modification || null,
                        commentaire: hist.commentaire || null,
                        updated_at: admin.firestore.FieldValue.serverTimestamp()
                    };

                    const docRef = db.collection('historique_status').doc(hist.id_historique.toString());
                    const docSnapshot = await docRef.get();

                    if (docSnapshot.exists) {
                        await docRef.update(historiqueData);
                    } else {
                        await docRef.set({
                            ...historiqueData,
                            created_at: admin.firestore.FieldValue.serverTimestamp()
                        });
                    }

                    historiquesSynced++;
                } catch (error) {
                    console.error(`❌ Erreur sync historique ${hist.id_historique}:`, error);
                    errors++;
                }
            }

            console.log(`✅ Vers Firebase: ${signalementsSynced} signalements, ${reparationsSynced} réparations, ${historiquesSynced} historiques`);
        } catch (error) {
            console.error('❌ Erreur sync vers Firebase:', error);
            errors++;
        }

        return { signalements: signalementsSynced, reparations: reparationsSynced, historiques: historiquesSynced, errors };
    }

    /**
     * Récupère les données de Firebase et les insère/met à jour dans PostgreSQL
     * Utilise updated_at pour détecter les modifications côté Firebase
     */
    private static async syncFromFirebaseAll(): Promise<{ signalements: number; reparations: number; historiques: number; errors: number }> {
        let signalementsSynced = 0;
        let reparationsSynced = 0;
        let historiquesSynced = 0;
        let errors = 0;

        try {
            const db = getFirestore();

            // ============================================
            // 1. SYNCHRONISER LES SIGNALEMENTS
            // ============================================
            const signalementsSnapshot = await db.collection('signalements').get();
            console.log(`📥 ${signalementsSnapshot.size} signalements trouvés dans Firebase`);

            for (const doc of signalementsSnapshot.docs) {
                try {
                    const data = doc.data();
                    const firebaseId = doc.id;

                    // Récupérer la date de modification Firebase (fallback sur date_signalement si updated_at n'existe pas)
                    let firebaseUpdatedAt = null;
                    if (data.updated_at?.toDate) {
                        firebaseUpdatedAt = data.updated_at.toDate();
                    } else if (data.date_signalement?.toDate) {
                        firebaseUpdatedAt = data.date_signalement.toDate();
                    }

                    // Vérifier si ce signalement existe déjà dans PostgreSQL
                    const existingResult = await query(
                        `SELECT id_signalement, derniere_sync, description, id_status 
                         FROM Signalement 
                         WHERE firebase_id = $1 OR id_signalement = $2`,
                        [firebaseId, data.postgres_id || 0]
                    );

                    if (existingResult.rows.length === 0) {
                        // ====== NOUVEAU SIGNALEMENT : Insérer ======
                        let localUserId = data.id_user;

                        if (data.firebase_uid) {
                            const userResult = await query(
                                'SELECT id_user FROM User_ WHERE firebase_uid = $1',
                                [data.firebase_uid]
                            );
                            if (userResult.rows.length > 0) {
                                localUserId = userResult.rows[0].id_user;
                            }
                        }

                        // Extraire les coordonnées
                        let latitude = null;
                        let longitude = null;
                        if (data.location) {
                            if (data.location._latitude !== undefined) {
                                latitude = data.location._latitude;
                                longitude = data.location._longitude;
                            } else if (data.location.latitude !== undefined) {
                                latitude = data.location.latitude;
                                longitude = data.location.longitude;
                            }
                        }

                        const insertResult = await query(
                            `INSERT INTO Signalement 
                             (location, description, id_user, id_status, firebase_id, est_synchronise, date_signalement, derniere_sync)
                             VALUES (
                                 CASE WHEN $1 IS NOT NULL AND $2 IS NOT NULL 
                                      THEN ST_SetSRID(ST_MakePoint($2, $1), 4326) 
                                      ELSE NULL END,
                                 $3, $4, $5, $6, TRUE, COALESCE($7, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
                             )
                             RETURNING id_signalement`,
                            [
                                latitude,
                                longitude,
                                data.description || null,
                                localUserId || 1,
                                data.id_status || 1,
                                firebaseId,
                                data.date_signalement?.toDate ? data.date_signalement.toDate() : null
                            ]
                        );

                        // Mettre à jour Firebase avec postgres_id, marqueur de sync et updated_at
                        await db.collection('signalements').doc(firebaseId).update({
                            postgres_id: insertResult.rows[0].id_signalement,
                            synced_to_postgres: true,
                            last_postgres_sync: admin.firestore.FieldValue.serverTimestamp(),
                            updated_at: admin.firestore.FieldValue.serverTimestamp()
                        });

                        console.log(`✅ Signalement IMPORTÉ de Firebase: ${firebaseId} -> ${insertResult.rows[0].id_signalement}`);
                        signalementsSynced++;

                    } else {
                        // ====== SIGNALEMENT EXISTANT : Vérifier si Firebase a des modifications plus récentes ======
                        const existingRow = existingResult.rows[0];
                        const postgresLastSync = existingRow.derniere_sync;

                        // Comparer les dates : si Firebase a été modifié après la dernière sync PostgreSQL
                        const needsUpdate = firebaseUpdatedAt &&
                            (!postgresLastSync || firebaseUpdatedAt > new Date(postgresLastSync));

                        if (needsUpdate) {
                            // Extraire les nouvelles coordonnées
                            let latitude = null;
                            let longitude = null;
                            if (data.location) {
                                if (data.location._latitude !== undefined) {
                                    latitude = data.location._latitude;
                                    longitude = data.location._longitude;
                                } else if (data.location.latitude !== undefined) {
                                    latitude = data.location.latitude;
                                    longitude = data.location.longitude;
                                }
                            }

                            await query(
                                `UPDATE Signalement 
                                 SET description = COALESCE($1, description),
                                     id_status = COALESCE($2, id_status),
                                     location = CASE WHEN $3 IS NOT NULL AND $4 IS NOT NULL 
                                                     THEN ST_SetSRID(ST_MakePoint($4, $3), 4326) 
                                                     ELSE location END,
                                     firebase_id = $5,
                                     est_synchronise = TRUE,
                                     derniere_sync = CURRENT_TIMESTAMP
                                 WHERE id_signalement = $6`,
                                [
                                    data.description,
                                    data.id_status,
                                    latitude,
                                    longitude,
                                    firebaseId,
                                    existingRow.id_signalement
                                ]
                            );

                            // Mettre à jour Firebase avec marqueur de sync et updated_at
                            await db.collection('signalements').doc(firebaseId).update({
                                synced_to_postgres: true,
                                last_postgres_sync: admin.firestore.FieldValue.serverTimestamp(),
                                updated_at: admin.firestore.FieldValue.serverTimestamp()
                            });

                            console.log(`🔄 Signalement ${existingRow.id_signalement} MIS À JOUR depuis Firebase (modifié le ${firebaseUpdatedAt})`);
                            signalementsSynced++;
                        } else {
                            // Juste mettre à jour firebase_id si nécessaire
                            if (!existingRow.firebase_id || existingRow.firebase_id !== firebaseId) {
                                await query(
                                    `UPDATE Signalement SET firebase_id = $1 WHERE id_signalement = $2`,
                                    [firebaseId, existingRow.id_signalement]
                                );
                            }

                            // Si le document Firebase n'a pas de updated_at, l'ajouter
                            if (!data.updated_at) {
                                await db.collection('signalements').doc(firebaseId).update({
                                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                                });
                                console.log(`📝 Ajout de updated_at au signalement Firebase: ${firebaseId}`);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ Erreur import signalement ${doc.id}:`, error);
                    errors++;
                }
            }

            // ============================================
            // 2. SYNCHRONISER LES RÉPARATIONS
            // ============================================
            const reparationsSnapshot = await db.collection('reparations').get();
            console.log(`📥 ${reparationsSnapshot.size} réparations trouvées dans Firebase`);

            for (const doc of reparationsSnapshot.docs) {
                try {
                    const data = doc.data();
                    const firebaseReparationId = data.id_reparation;
                    const firebaseUpdatedAt = data.updated_at?.toDate ? data.updated_at.toDate() : null;

                    // Vérifier si cette réparation existe déjà
                    const existingResult = await query(
                        'SELECT id_reparation, derniere_sync FROM Reparation WHERE id_reparation = $1',
                        [firebaseReparationId]
                    );

                    if (existingResult.rows.length === 0 && data.id_signalement) {
                        // ====== NOUVELLE RÉPARATION : Insérer ======
                        const signalementResult = await query(
                            'SELECT id_signalement FROM Signalement WHERE id_signalement = $1',
                            [data.id_signalement]
                        );

                        if (signalementResult.rows.length > 0) {
                            await query(
                                `INSERT INTO Reparation 
                                 (surface_m2, budget, id_entreprise, date_debut, 
                                  date_fin_prevue, date_fin_reelle, commentaire, id_signalement, id_status, id_user,
                                  est_synchronise, firebase_id, derniere_sync)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, CURRENT_TIMESTAMP)`,
                                [
                                    data.surface_m2 || 0,
                                    data.budget || 0,
                                    data.id_entreprise || 1,
                                    data.date_debut || null,
                                    data.date_fin_prevue || null,
                                    data.date_fin_reelle || null,
                                    data.commentaire || null,
                                    data.id_signalement,
                                    data.id_status || 2,
                                    data.id_user || 1,
                                    firebaseReparationId.toString()
                                ]
                            );

                            // Mettre à jour Firebase avec marqueur de sync
                            await db.collection('reparations').doc(doc.id).update({
                                synced_to_postgres: true,
                                last_postgres_sync: admin.firestore.FieldValue.serverTimestamp()
                            });

                            console.log(`✅ Réparation IMPORTÉE de Firebase: ${firebaseReparationId}`);
                            reparationsSynced++;
                        }
                    } else if (existingResult.rows.length > 0) {
                        // ====== RÉPARATION EXISTANTE : Vérifier si Firebase a des modifications plus récentes ======
                        const existingRow = existingResult.rows[0];
                        const postgresLastSync = existingRow.derniere_sync;

                        const needsUpdate = firebaseUpdatedAt &&
                            (!postgresLastSync || firebaseUpdatedAt > new Date(postgresLastSync));

                        if (needsUpdate) {
                            await query(
                                `UPDATE Reparation 
                                 SET surface_m2 = COALESCE($1, surface_m2),
                                     budget = COALESCE($2, budget),
                                     id_entreprise = COALESCE($3, id_entreprise),
                                     date_debut = COALESCE($4, date_debut),
                                     date_fin_prevue = COALESCE($5, date_fin_prevue),
                                     date_fin_reelle = COALESCE($6, date_fin_reelle),
                                     commentaire = COALESCE($7, commentaire),
                                     id_status = COALESCE($8, id_status),
                                     est_synchronise = TRUE,
                                     derniere_sync = CURRENT_TIMESTAMP
                                 WHERE id_reparation = $9`,
                                [
                                    data.surface_m2,
                                    data.budget,
                                    data.id_entreprise,
                                    data.date_debut || null,
                                    data.date_fin_prevue || null,
                                    data.date_fin_reelle || null,
                                    data.commentaire,
                                    data.id_status,
                                    firebaseReparationId
                                ]
                            );

                            // Mettre à jour Firebase avec marqueur de sync
                            await db.collection('reparations').doc(doc.id).update({
                                synced_to_postgres: true,
                                last_postgres_sync: admin.firestore.FieldValue.serverTimestamp()
                            });

                            console.log(`🔄 Réparation ${firebaseReparationId} MISE À JOUR depuis Firebase`);
                            reparationsSynced++;
                        }
                    }
                } catch (error) {
                    console.error(`❌ Erreur import réparation ${doc.id}:`, error);
                    errors++;
                }
            }

            // ============================================
            // 3. SYNCHRONISER L'HISTORIQUE DES STATUTS
            // ============================================
            const historiquesSnapshot = await db.collection('historique_status').get();
            console.log(`📥 ${historiquesSnapshot.size} historiques de status trouvés dans Firebase`);

            for (const doc of historiquesSnapshot.docs) {
                try {
                    const data = doc.data();
                    const firebaseHistoriqueId = data.id_historique;

                    // Vérifier si cet historique existe déjà
                    const existingResult = await query(
                        'SELECT id_historique FROM HistoriqueStatus WHERE id_historique = $1',
                        [firebaseHistoriqueId]
                    );

                    if (existingResult.rows.length === 0 && data.id_reparation) {
                        // ====== NOUVEL HISTORIQUE : Insérer ======
                        const reparationResult = await query(
                            'SELECT id_reparation FROM Reparation WHERE id_reparation = $1',
                            [data.id_reparation]
                        );

                        if (reparationResult.rows.length > 0) {
                            await query(
                                `INSERT INTO HistoriqueStatus 
                                 (id_reparation, id_status_ancien, id_status_nouveau, id_user, date_modification, commentaire)
                                 VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_TIMESTAMP), $6)
                                 ON CONFLICT DO NOTHING`,
                                [
                                    data.id_reparation,
                                    data.id_status_ancien || null,
                                    data.id_status_nouveau,
                                    data.id_user || 1,
                                    data.date_modification?.toDate ? data.date_modification.toDate() : null,
                                    data.commentaire || null
                                ]
                            );

                            console.log(`✅ Historique IMPORTÉ de Firebase: ${firebaseHistoriqueId}`);
                            historiquesSynced++;
                        }
                    }
                    // Note: Les historiques ne sont pas mis à jour, seulement insérés (données immuables)
                } catch (error) {
                    console.error(`❌ Erreur import historique ${doc.id}:`, error);
                    errors++;
                }
            }

            console.log(`✅ Depuis Firebase: ${signalementsSynced} signalements, ${reparationsSynced} réparations, ${historiquesSynced} historiques`);
        } catch (error) {
            console.error('❌ Erreur sync depuis Firebase:', error);
            errors++;
        }

        return { signalements: signalementsSynced, reparations: reparationsSynced, historiques: historiquesSynced, errors };
    }

    // ============================================
    // HELPERS
    // ============================================

    private static mapRowToSignalement(row: any): Signalement {
        return {
            id_signalement: row.id_signalement,
            location: row.longitude && row.latitude ? {
                latitude: parseFloat(row.latitude),
                longitude: parseFloat(row.longitude)
            } : null,
            description: row.description,
            date_signalement: row.date_signalement,
            firebase_id: row.firebase_id,
            est_synchronise: row.est_synchronise,
            id_user: row.id_user,
            id_status: row.id_status
        };
    }

    private static mapRowToSignalementWithDetails(row: any): SignalementWithDetails {
        return {
            ...this.mapRowToSignalement(row),
            status_libelle: row.status_libelle,
            status_couleur: row.status_couleur,
            user_display_name: row.user_display_name,
            user_email: row.user_email,
            reparation: row.id_reparation ? {
                id_reparation: row.id_reparation,
                surface_m2: parseFloat(row.surface_m2),
                budget: parseFloat(row.budget),
                date_debut: row.date_debut,
                date_fin_prevue: row.date_fin_prevue,
                date_fin_reelle: row.date_fin_reelle,
                commentaire: row.reparation_commentaire,
                entreprise_nom: row.entreprise_nom,
                entreprise_tel: row.entreprise_tel
            } : null
        };
    }
}

export default SignalementService;

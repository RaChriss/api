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

            // Marquer comme synchronisé
            await query(
                `UPDATE Signalement SET firebase_id = $1, est_synchronise = TRUE 
         WHERE id_signalement = $2`,
                [signalement.firebase_id, signalement.id_signalement]
            );

            console.log(`✅ Signalement ${signalement.id_signalement} synchronisé`);
        } catch (error) {
            console.warn('⚠️ Erreur sync Firebase:', (error as Error).message);
            throw error;
        }
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

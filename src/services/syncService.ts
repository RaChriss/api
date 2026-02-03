import * as admin from 'firebase-admin';
import pool from '../config/database';
import { isFirebaseOnline } from '../config/firebase';

/**
 * Résultat de synchronisation
 */
interface SyncResult {
    success: boolean;
    synced: number;
    conflicts: number;
    errors: number;
    details: Array<{
        type: string;
        message: string;
        data?: any;
    }>;
}

/**
 * Service de synchronisation bidirectionnelle entre PostgreSQL et Firebase
 * Gère la synchronisation complète de toutes les tables
 */
export class SyncService {
    private static instance: SyncService;
    private syncInProgress: boolean = false;
    private lastSyncTimestamp: Date | null = null;
    private autoSyncEnabled: boolean = true;
    private firestoreListeners: Array<() => void> = [];

    private constructor() {
        this.initializeListeners();
    }

    public static getInstance(): SyncService {
        if (!SyncService.instance) {
            SyncService.instance = new SyncService();
        }
        return SyncService.instance;
    }

    /**
     * Initialise les listeners Firebase pour toutes les collections
     */
    private async initializeListeners(): Promise<void> {
        try {
            const isOnline = await isFirebaseOnline();
            if (!isOnline) {
                console.log('🟠 Firebase hors ligne - listeners désactivés');
                return;
            }

            // Listener Signalements
            const signalementListener = admin.firestore()
                .collection('signalements')
                .onSnapshot(async (snapshot) => {
                    if (!this.autoSyncEnabled) return;
                    for (const change of snapshot.docChanges()) {
                        try {
                            if (change.type === 'added' || change.type === 'modified') {
                                await this.syncSignalementFromFirebase(change.doc.id, change.doc.data());
                            } else if (change.type === 'removed') {
                                await this.deleteFromPostgres('Signalement', 'id_signalement', change.doc.id);
                            }
                        } catch (error: any) {
                            console.error(`❌ Erreur listener signalement ${change.doc.id}:`, error.message);
                        }
                    }
                });

            // Listener Réparations
            const reparationListener = admin.firestore()
                .collection('reparations')
                .onSnapshot(async (snapshot) => {
                    if (!this.autoSyncEnabled) return;
                    for (const change of snapshot.docChanges()) {
                        try {
                            if (change.type === 'added' || change.type === 'modified') {
                                await this.syncReparationFromFirebase(change.doc.id, change.doc.data());
                            } else if (change.type === 'removed') {
                                await this.deleteFromPostgres('Reparation', 'id_reparation', change.doc.id);
                            }
                        } catch (error: any) {
                            console.error(`❌ Erreur listener réparation ${change.doc.id}:`, error.message);
                        }
                    }
                });

            // Listener Entreprises
            const entrepriseListener = admin.firestore()
                .collection('entreprises')
                .onSnapshot(async (snapshot) => {
                    if (!this.autoSyncEnabled) return;
                    for (const change of snapshot.docChanges()) {
                        try {
                            if (change.type === 'added' || change.type === 'modified') {
                                await this.syncEntrepriseFromFirebase(change.doc.id, change.doc.data());
                            } else if (change.type === 'removed') {
                                await this.deleteFromPostgres('Entreprise', 'id_entreprise', change.doc.id);
                            }
                        } catch (error: any) {
                            console.error(`❌ Erreur listener entreprise ${change.doc.id}:`, error.message);
                        }
                    }
                });

            // Listener Status
            const statusListener = admin.firestore()
                .collection('status')
                .onSnapshot(async (snapshot) => {
                    if (!this.autoSyncEnabled) return;
                    for (const change of snapshot.docChanges()) {
                        try {
                            if (change.type === 'added' || change.type === 'modified') {
                                await this.syncStatusFromFirebase(change.doc.id, change.doc.data());
                            } else if (change.type === 'removed') {
                                await this.deleteFromPostgres('Status', 'id_status', change.doc.id);
                            }
                        } catch (error: any) {
                            console.error(`❌ Erreur listener status ${change.doc.id}:`, error.message);
                        }
                    }
                });

            this.firestoreListeners.push(signalementListener, reparationListener, entrepriseListener, statusListener);
            console.log('✅ Listeners Firebase initialisés pour toutes les collections');
        } catch (error: any) {
            console.warn('⚠️ Impossible d\'initialiser les listeners Firebase:', error.message);
        }
    }

    /**
     * Active/désactive la synchronisation automatique
     */
    public setAutoSync(enabled: boolean): void {
        this.autoSyncEnabled = enabled;
        console.log(`🔄 Synchronisation automatique: ${enabled ? 'activée' : 'désactivée'}`);
    }

    public isAutoSyncEnabled(): boolean {
        return this.autoSyncEnabled;
    }

    // ============================================
    // SYNCHRONISATION SIGNALEMENTS
    // ============================================

    private async syncSignalementFromFirebase(firebaseId: string, data: any): Promise<void> {
        try {
            const checkQuery = 'SELECT id_signalement, updated_at, sync_version FROM Signalement WHERE firebase_id = $1';
            const checkResult = await pool.query(checkQuery, [firebaseId]);

            const firebaseTimestamp = data.updated_at ? new Date(data.updated_at.toDate()) : new Date();

            if (checkResult.rows.length > 0) {
                const existing = checkResult.rows[0];
                const postgresTimestamp = new Date(existing.updated_at);

                if (postgresTimestamp > firebaseTimestamp) {
                    console.log(`⚠️ Conflit signalement ${firebaseId} - PostgreSQL plus récent`);
                    await this.logSyncConflict('Signalement', existing.id_signalement, firebaseId, 'PostgreSQL plus récent');
                    return;
                }

                const locationPart = data.location ? `ST_GeomFromText('POINT(${data.location.longitude} ${data.location.latitude})', 4326)` : 'NULL';
                const updateQuery = `
          UPDATE Signalement 
          SET location = ${locationPart}, 
              description = $1, id_status = $2,
              updated_at = $3, sync_version = sync_version + 1, est_synchronise = TRUE
          WHERE firebase_id = $4
        `;

                await pool.query(updateQuery, [data.description, data.status_id || 1, firebaseTimestamp, firebaseId]);
                console.log(`✅ Signalement ${firebaseId} mis à jour`);
            } else {
                const locationPart = data.location ? `ST_GeomFromText('POINT(${data.location.longitude} ${data.location.latitude})', 4326)` : 'NULL';
                const insertQuery = `
          INSERT INTO Signalement (firebase_id, location, description, id_user, id_status, 
                                   date_signalement, updated_at, sync_version, est_synchronise)
          VALUES ($1, ${locationPart}, $2, $3, $4, $5, $6, 1, TRUE)
        `;

                await pool.query(insertQuery, [
                    firebaseId, data.description, data.user_id || 1, data.status_id || 1,
                    data.date_signalement || new Date(), firebaseTimestamp
                ]);
                console.log(`✅ Nouveau signalement ${firebaseId} créé`);
            }

            await this.logSync('Signalement', null, firebaseId, 'UPDATE', 'SUCCESS');
        } catch (error: any) {
            console.error(`❌ Erreur sync signalement ${firebaseId}:`, error);
            await this.logSync('Signalement', null, firebaseId, 'UPDATE', 'FAILED', error.message);
        }
    }

    // ============================================
    // SYNCHRONISATION REPARATIONS
    // ============================================

    private async syncReparationFromFirebase(firebaseId: string, data: any): Promise<void> {
        try {
            const checkQuery = 'SELECT id_reparation, updated_at FROM Reparation WHERE firebase_id = $1';
            const checkResult = await pool.query(checkQuery, [firebaseId]);

            const firebaseTimestamp = data.updated_at ? new Date(data.updated_at.toDate()) : new Date();

            if (checkResult.rows.length > 0) {
                const existing = checkResult.rows[0];
                const postgresTimestamp = new Date(existing.updated_at);

                if (postgresTimestamp > firebaseTimestamp) {
                    console.log(`⚠️ Conflit réparation ${firebaseId}`);
                    await this.logSyncConflict('Reparation', existing.id_reparation, firebaseId, 'PostgreSQL plus récent');
                    return;
                }

                const updateQuery = `
          UPDATE Reparation 
          SET surface_m2 = $1, budget = $2, date_debut = $3, date_fin_prevue = $4, 
              date_fin_reelle = $5, commentaire = $6, id_status = $7, id_entreprise = $8,
              updated_at = $9, sync_version = sync_version + 1, est_synchronise = TRUE
          WHERE firebase_id = $10
        `;

                await pool.query(updateQuery, [
                    data.surface_m2, data.budget, data.date_debut, data.date_fin_prevue,
                    data.date_fin_reelle, data.commentaire, data.id_status, data.id_entreprise,
                    firebaseTimestamp, firebaseId
                ]);
                console.log(`✅ Réparation ${firebaseId} mise à jour`);
            } else {
                const insertQuery = `
          INSERT INTO Reparation (firebase_id, surface_m2, budget, date_debut, date_fin_prevue,
                                  date_fin_reelle, commentaire, id_signalement, id_entreprise,
                                  id_status, id_user, date_creation, updated_at, sync_version, est_synchronise)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, TRUE)
        `;

                await pool.query(insertQuery, [
                    firebaseId, data.surface_m2, data.budget, data.date_debut, data.date_fin_prevue,
                    data.date_fin_reelle, data.commentaire, data.id_signalement, data.id_entreprise,
                    data.id_status, data.id_user, data.date_creation || new Date(), firebaseTimestamp
                ]);
                console.log(`✅ Nouvelle réparation ${firebaseId} créée`);
            }

            await this.logSync('Reparation', null, firebaseId, 'UPDATE', 'SUCCESS');
        } catch (error: any) {
            console.error(`❌ Erreur sync réparation ${firebaseId}:`, error);
            await this.logSync('Reparation', null, firebaseId, 'UPDATE', 'FAILED', error.message);
        }
    }

    // ============================================
    // SYNCHRONISATION ENTREPRISES
    // ============================================

    private async syncEntrepriseFromFirebase(firebaseId: string, data: any): Promise<void> {
        try {
            const checkQuery = 'SELECT id_entreprise, updated_at FROM Entreprise WHERE firebase_id = $1';
            const checkResult = await pool.query(checkQuery, [firebaseId]);

            const firebaseTimestamp = data.updated_at ? new Date(data.updated_at.toDate()) : new Date();

            if (checkResult.rows.length > 0) {
                const existing = checkResult.rows[0];
                const postgresTimestamp = new Date(existing.updated_at);

                if (postgresTimestamp > firebaseTimestamp) {
                    console.log(`⚠️ Conflit entreprise ${firebaseId}`);
                    await this.logSyncConflict('Entreprise', existing.id_entreprise, firebaseId, 'PostgreSQL plus récent');
                    return;
                }

                const updateQuery = `
          UPDATE Entreprise 
          SET nom = $1, telephone = $2, email = $3, adresse = $4,
              updated_at = $5, sync_version = sync_version + 1, est_synchronise = TRUE
          WHERE firebase_id = $6
        `;

                await pool.query(updateQuery, [
                    data.nom, data.telephone, data.email, data.adresse, firebaseTimestamp, firebaseId
                ]);
                console.log(`✅ Entreprise ${firebaseId} mise à jour`);
            } else {
                const insertQuery = `
          INSERT INTO Entreprise (firebase_id, nom, telephone, email, adresse, 
                                  updated_at, sync_version, est_synchronise)
          VALUES ($1, $2, $3, $4, $5, $6, 1, TRUE)
        `;

                await pool.query(insertQuery, [
                    firebaseId, data.nom, data.telephone, data.email, data.adresse, firebaseTimestamp
                ]);
                console.log(`✅ Nouvelle entreprise ${firebaseId} créée`);
            }

            await this.logSync('Entreprise', null, firebaseId, 'UPDATE', 'SUCCESS');
        } catch (error: any) {
            console.error(`❌ Erreur sync entreprise ${firebaseId}:`, error);
            await this.logSync('Entreprise', null, firebaseId, 'UPDATE', 'FAILED', error.message);
        }
    }

    // ============================================
    // SYNCHRONISATION STATUS
    // ============================================

    private async syncStatusFromFirebase(firebaseId: string, data: any): Promise<void> {
        try {
            const checkQuery = 'SELECT id_status, updated_at FROM Status WHERE firebase_id = $1';
            const checkResult = await pool.query(checkQuery, [firebaseId]);

            const firebaseTimestamp = data.updated_at ? new Date(data.updated_at.toDate()) : new Date();

            if (checkResult.rows.length > 0) {
                const existing = checkResult.rows[0];
                const postgresTimestamp = new Date(existing.updated_at);

                if (postgresTimestamp > firebaseTimestamp) {
                    console.log(`⚠️ Conflit status ${firebaseId}`);
                    await this.logSyncConflict('Status', existing.id_status, firebaseId, 'PostgreSQL plus récent');
                    return;
                }

                const updateQuery = `
          UPDATE Status 
          SET libelle = $1, couleur = $2, updated_at = $3, 
              sync_version = sync_version + 1, est_synchronise = TRUE
          WHERE firebase_id = $4
        `;

                await pool.query(updateQuery, [data.libelle, data.couleur, firebaseTimestamp, firebaseId]);
                console.log(`✅ Status ${firebaseId} mis à jour`);
            } else {
                const insertQuery = `
          INSERT INTO Status (firebase_id, libelle, couleur, updated_at, sync_version, est_synchronise)
          VALUES ($1, $2, $3, $4, 1, TRUE)
        `;

                await pool.query(insertQuery, [firebaseId, data.libelle, data.couleur, firebaseTimestamp]);
                console.log(`✅ Nouveau status ${firebaseId} créé`);
            }

            await this.logSync('Status', null, firebaseId, 'UPDATE', 'SUCCESS');
        } catch (error: any) {
            console.error(`❌ Erreur sync status ${firebaseId}:`, error);
            await this.logSync('Status', null, firebaseId, 'UPDATE', 'FAILED', error.message);
        }
    }

    // ============================================
    // SYNCHRONISATION POSTGRESQL → FIREBASE
    // ============================================

    public async syncPostgresToFirebase(): Promise<SyncResult> {
        if (this.syncInProgress) {
            return {
                success: false, synced: 0, conflicts: 0, errors: 1,
                details: [{ type: 'error', message: 'Synchronisation déjà en cours' }]
            };
        }

        this.syncInProgress = true;
        const result: SyncResult = { success: true, synced: 0, conflicts: 0, errors: 0, details: [] };

        try {
            const isOnline = await isFirebaseOnline();
            if (!isOnline) throw new Error('Firebase non disponible');

            // Synchroniser Signalements
            await this.syncTableToFirebase('Signalement', 'signalements', result);

            // Synchroniser Réparations
            await this.syncTableToFirebase('Reparation', 'reparations', result);

            // Synchroniser Entreprises
            await this.syncTableToFirebase('Entreprise', 'entreprises', result);

            // Synchroniser Status
            await this.syncTableToFirebase('Status', 'status', result);

            this.lastSyncTimestamp = new Date();
            console.log(`✅ Sync PostgreSQL→Firebase: ${result.synced} réussies, ${result.conflicts} conflits`);
        } catch (error: any) {
            result.success = false;
            result.errors++;
            result.details.push({ type: 'error', message: error.message });
        } finally {
            this.syncInProgress = false;
        }

        return result;
    }

    private async syncTableToFirebase(tableName: string, collectionName: string, result: SyncResult): Promise<void> {
        const query = `
      SELECT * FROM ${tableName}
      WHERE est_synchronise = FALSE OR updated_at > COALESCE((
        SELECT MAX(sync_date) FROM SyncLog 
        WHERE table_name = '${tableName}' AND status = 'SUCCESS'
      ), '1970-01-01')
    `;

        const postgresResult = await pool.query(query);
        console.log(`🔄 ${postgresResult.rows.length} ${tableName} à synchroniser vers Firebase`);

        for (const row of postgresResult.rows) {
            try {
                const docData = this.prepareFirebaseData(tableName, row);
                const idColumn = `id_${tableName.toLowerCase()}`;

                if (row.firebase_id) {
                    const docRef = admin.firestore().collection(collectionName).doc(row.firebase_id);
                    const docSnap = await docRef.get();

                    if (docSnap.exists) {
                        const firebaseData = docSnap.data();
                        const firebaseTimestamp = firebaseData?.updated_at?.toDate() || new Date(0);
                        const postgresTimestamp = new Date(row.updated_at || row.date_creation);

                        if (firebaseTimestamp > postgresTimestamp) {
                            result.conflicts++;
                            result.details.push({ type: 'conflict', message: `Conflit ${tableName} ID ${row[idColumn]}` });
                            await this.logSyncConflict(tableName, row[idColumn], row.firebase_id, 'Firebase plus récent');
                            continue;
                        }
                    }

                    await docRef.set(docData, { merge: true });
                } else {
                    const docRef = await admin.firestore().collection(collectionName).add(docData);
                    await pool.query(`UPDATE ${tableName} SET firebase_id = $1 WHERE ${idColumn} = $2`,
                        [docRef.id, row[idColumn]]);
                }

                await pool.query(`UPDATE ${tableName} SET est_synchronise = TRUE WHERE ${idColumn} = $1`,
                    [row[idColumn]]);
                result.synced++;
                await this.logSync(tableName, row[idColumn], row.firebase_id, 'UPDATE', 'SUCCESS');
            } catch (error: any) {
                result.errors++;
                result.details.push({ type: 'error', message: `Erreur ${tableName}: ${error.message}` });
            }
        }
    }

    private prepareFirebaseData(tableName: string, row: any): any {
        const baseData = {
            updated_at: admin.firestore.Timestamp.fromDate(new Date(row.updated_at || row.date_creation || new Date())),
            sync_version: row.sync_version || 1
        };

        switch (tableName) {
            case 'Signalement':
                return {
                    ...baseData,
                    location: row.location ? {
                        latitude: row.location.coordinates[1],
                        longitude: row.location.coordinates[0]
                    } : null,
                    description: row.description,
                    user_id: row.id_user,
                    status_id: row.id_status,
                    date_signalement: admin.firestore.Timestamp.fromDate(new Date(row.date_signalement)),
                    postgres_id: row.id_signalement
                };

            case 'Reparation':
                return {
                    ...baseData,
                    surface_m2: parseFloat(row.surface_m2),
                    budget: parseFloat(row.budget),
                    date_debut: row.date_debut,
                    date_fin_prevue: row.date_fin_prevue,
                    date_fin_reelle: row.date_fin_reelle,
                    commentaire: row.commentaire,
                    id_signalement: row.id_signalement,
                    id_entreprise: row.id_entreprise,
                    id_status: row.id_status,
                    id_user: row.id_user,
                    postgres_id: row.id_reparation
                };

            case 'Entreprise':
                return {
                    ...baseData,
                    nom: row.nom,
                    telephone: row.telephone,
                    email: row.email,
                    adresse: row.adresse,
                    postgres_id: row.id_entreprise
                };

            case 'Status':
                return {
                    ...baseData,
                    libelle: row.libelle,
                    couleur: row.couleur,
                    postgres_id: row.id_status
                };

            default:
                return baseData;
        }
    }

    // ============================================
    // SYNCHRONISATION FIREBASE → POSTGRESQL
    // ============================================

    public async syncFirebaseToPostgres(): Promise<SyncResult> {
        if (this.syncInProgress) {
            return {
                success: false, synced: 0, conflicts: 0, errors: 1,
                details: [{ type: 'error', message: 'Synchronisation déjà en cours' }]
            };
        }

        this.syncInProgress = true;
        const result: SyncResult = { success: true, synced: 0, conflicts: 0, errors: 0, details: [] };

        try {
            const isOnline = await isFirebaseOnline();
            if (!isOnline) throw new Error('Firebase non disponible');

            // Synchroniser toutes les collections
            const collections = [
                { name: 'signalements', handler: this.syncSignalementFromFirebase.bind(this) },
                { name: 'reparations', handler: this.syncReparationFromFirebase.bind(this) },
                { name: 'entreprises', handler: this.syncEntrepriseFromFirebase.bind(this) },
                { name: 'status', handler: this.syncStatusFromFirebase.bind(this) }
            ];

            for (const collection of collections) {
                const snapshot = await admin.firestore().collection(collection.name).get();
                console.log(`🔄 ${snapshot.size} documents dans ${collection.name}`);

                for (const doc of snapshot.docs) {
                    try {
                        await collection.handler(doc.id, doc.data());
                        result.synced++;
                    } catch (error: any) {
                        result.errors++;
                        result.details.push({ type: 'error', message: `Erreur ${collection.name}: ${error.message}` });
                    }
                }
            }

            this.lastSyncTimestamp = new Date();
            console.log(`✅ Sync Firebase→PostgreSQL terminée: ${result.synced} réussies, ${result.errors} erreurs`);
        } catch (error: any) {
            result.success = false;
            result.errors++;
            result.details.push({ type: 'error', message: error.message });
        } finally {
            this.syncInProgress = false;
        }

        return result;
    }

    // ============================================
    // SYNCHRONISATION BIDIRECTIONNELLE
    // ============================================

    public async syncBidirectional(): Promise<SyncResult> {
        console.log('🔄 Démarrage synchronisation bidirectionnelle complète...');

        const firebaseToPostgres = await this.syncFirebaseToPostgres();
        const postgresToFirebase = await this.syncPostgresToFirebase();

        return {
            success: firebaseToPostgres.success && postgresToFirebase.success,
            synced: firebaseToPostgres.synced + postgresToFirebase.synced,
            conflicts: firebaseToPostgres.conflicts + postgresToFirebase.conflicts,
            errors: firebaseToPostgres.errors + postgresToFirebase.errors,
            details: [...firebaseToPostgres.details, ...postgresToFirebase.details]
        };
    }

    // ============================================
    // UTILITAIRES
    // ============================================

    private async deleteFromPostgres(tableName: string, idColumn: string, firebaseId: string): Promise<void> {
        try {
            const deleteQuery = `DELETE FROM ${tableName} WHERE firebase_id = $1 RETURNING ${idColumn}`;
            const result = await pool.query(deleteQuery, [firebaseId]);

            if (result.rows.length > 0) {
                console.log(`✅ ${tableName} ${firebaseId} supprimé`);
                await this.logSync(tableName, result.rows[0][idColumn], firebaseId, 'DELETE', 'SUCCESS');
            }
        } catch (error: any) {
            console.error(`❌ Erreur suppression ${tableName} ${firebaseId}:`, error);
            await this.logSync(tableName, null, firebaseId, 'DELETE', 'FAILED', error.message);
        }
    }

    private async logSync(tableName: string, recordId: number | null, firebaseId: string | null,
        operation: string, status: string, errorMessage?: string): Promise<void> {
        try {
            const query = `
        INSERT INTO SyncLog (table_name, record_id, firebase_id, operation, status, error_message)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
            await pool.query(query, [tableName, recordId, firebaseId, operation, status, errorMessage || null]);
        } catch (error: any) {
            console.error('Erreur log sync:', error.message);
        }
    }

    private async logSyncConflict(tableName: string, recordId: number, firebaseId: string, reason: string): Promise<void> {
        await this.logSync(tableName, recordId, firebaseId, 'CONFLICT', 'CONFLICT', reason);
    }

    public async getSyncStats(): Promise<any> {
        try {
            const queries = await Promise.all([
                pool.query('SELECT COUNT(*) as count FROM Signalement WHERE est_synchronise = FALSE'),
                pool.query('SELECT COUNT(*) as count FROM Reparation WHERE est_synchronise = FALSE'),
                pool.query('SELECT COUNT(*) as count FROM Entreprise WHERE est_synchronise = FALSE'),
                pool.query('SELECT COUNT(*) as count FROM Status WHERE est_synchronise = FALSE'),
                pool.query(`SELECT COUNT(*) as count FROM SyncLog WHERE status = 'CONFLICT' AND sync_date > NOW() - INTERVAL '24 hours'`),
                pool.query(`SELECT COUNT(*) as count FROM SyncLog WHERE status = 'FAILED' AND sync_date > NOW() - INTERVAL '24 hours'`)
            ]);

            return {
                last_sync: this.lastSyncTimestamp,
                sync_in_progress: this.syncInProgress,
                auto_sync_enabled: this.autoSyncEnabled,
                pending_signalements: parseInt(queries[0].rows[0].count),
                pending_reparations: parseInt(queries[1].rows[0].count),
                pending_entreprises: parseInt(queries[2].rows[0].count),
                pending_status: parseInt(queries[3].rows[0].count),
                total_conflicts: parseInt(queries[4].rows[0].count),
                total_errors: parseInt(queries[5].rows[0].count)
            };
        } catch (error: any) {
            console.error('Erreur récupération stats sync:', error);
            return {
                last_sync: this.lastSyncTimestamp,
                sync_in_progress: this.syncInProgress,
                auto_sync_enabled: this.autoSyncEnabled,
                pending_signalements: 0,
                pending_reparations: 0,
                pending_entreprises: 0,
                pending_status: 0,
                total_conflicts: 0,
                total_errors: 0
            };
        }
    }

    public stopListeners(): void {
        for (const unsubscribe of this.firestoreListeners) {
            unsubscribe();
        }
        this.firestoreListeners = [];
        console.log('🛑 Listeners Firebase arrêtés');
    }
}

export const syncService = SyncService.getInstance();

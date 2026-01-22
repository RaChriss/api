import * as admin from 'firebase-admin';
import pool from '../config/database';
import { isFirebaseOnline, getFirebaseStatus } from '../config/firebase';

interface SignalementData {
  location?: { latitude: number; longitude: number };
  description?: string;
  user_id: number;
  status_id?: number;
  date_signalement?: Date;
}

interface UserData {
  firebase_uid: string;
  email: string;
  display_name?: string;
  type_user?: number;
}

export class HybridDataService {
  private static instance: HybridDataService;

  private constructor() {
    // Initialisation simple - la surveillance est gérée par firebase.ts
  }

  public static getInstance(): HybridDataService {
    if (!HybridDataService.instance) {
      HybridDataService.instance = new HybridDataService();
    }
    return HybridDataService.instance;
  }

  /**
   * Retourne l'état de la connexion Firebase
   */
  public async isFirebaseAvailable(): Promise<boolean> {
    try {
      return await isFirebaseOnline();
    } catch (error: any) {
      // Mode hors-ligne - ne pas logger l'erreur, c'est normal
      return false;
    }
  }

  /**
   * Retourne l'état synchrone (cache) de Firebase
   */
  public isFirebaseAvailableSync(): boolean {
    return getFirebaseStatus().available;
  }

  /**
   * Crée un signalement (Firebase ou PostgreSQL selon la connexion)
   */
  public async createSignalement(data: SignalementData): Promise<{ id: string; source: 'firebase' | 'postgres' }> {
    const isOnline = await this.isFirebaseAvailable();

    if (isOnline) {
      // Mode online : utiliser Firebase ET PostgreSQL
      console.log('📡 Mode en ligne : création dans Firebase + PostgreSQL');

      try {
        // 1. Créer dans PostgreSQL d'abord
        const postgresResult = await this.createSignalementPostgres(data);

        // 2. Créer dans Firebase avec référence PostgreSQL
        try {
          await admin.firestore().collection('signalements').add({
            location: data.location || null,
            user_id: data.user_id,
            status_id: data.status_id || 1,
            date_signalement: data.date_signalement || admin.firestore.FieldValue.serverTimestamp(),
            postgres_id: postgresResult.id,
            created_online: true
          });

          console.log('✅ Signalement créé dans Firebase + PostgreSQL');
        } catch (firebaseError) {
          console.warn('⚠️ Erreur Firebase (PostgreSQL OK):', (firebaseError as Error).message);
        }

        return postgresResult; // Retourner l'ID PostgreSQL
      } catch (error) {
        console.error('❌ Erreur création signalement:', error);
        throw error;
      }
    } else {
      // Mode offline : PostgreSQL seulement
      console.log('💾 Mode hors ligne : création dans PostgreSQL uniquement');
      return await this.createSignalementPostgres(data);
    }
  }

  /**
   * Crée un signalement dans PostgreSQL
   */
  private async createSignalementPostgres(data: SignalementData): Promise<{ id: string; source: 'postgres' }> {
    const query = `
      INSERT INTO Signalement (latitude, longitude, description, id_user, id_status, est_synchronise)
      VALUES ($1, $2, $3, $4, $5, FALSE)
      RETURNING id_signalement
    `;

    const values = [
      data.location?.latitude || null,
      data.location?.longitude || null,
      data.description || 'Signalement créé hors ligne',
      data.user_id,
      data.status_id || 1
    ];

    const result = await pool.query(query, values);
    return { id: result.rows[0].id_signalement.toString(), source: 'postgres' };
  }

  /**
   * Récupère les signalements (Firebase ou PostgreSQL selon la connexion)
   */
  public async getSignalements(): Promise<{ data: any[]; source: 'firebase' | 'postgres' }> {
    const isOnline = await this.isFirebaseAvailable();

    if (isOnline) {
      // Mode online : Firebase en priorité, PostgreSQL en fallback
      console.log('📡 Mode en ligne : lecture Firebase (avec fallback PostgreSQL)');

      try {
        const snapshot = await admin.firestore().collection('signalements').get();
        const signalements = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log(`✅ ${signalements.length} signalements récupérés depuis Firebase`);
        return { data: signalements, source: 'firebase' };
      } catch (error) {
        console.log('⚠️ Récupération Firebase échouée, utilisation de PostgreSQL:', (error as Error).message);
        return await this.getSignalementsPostgres();
      }
    } else {
      // Mode offline : PostgreSQL seulement
      console.log('💾 Mode hors ligne : lecture PostgreSQL uniquement');
      return await this.getSignalementsPostgres();
    }
  }

  /**
   * Récupère les signalements depuis PostgreSQL
   */
  private async getSignalementsPostgres(): Promise<{ data: any[]; source: 'postgres' }> {
    const query = `
      SELECT 
        s.id_signalement as id,
        s.longitude,
        s.latitude,
        s.description,
        s.date_signalement,
        s.firebase_id,
        s.est_synchronise,
        u.email,
        u.display_name,
        st.libelle as status
      FROM Signalement s
      JOIN User_ u ON s.id_user = u.id_user
      JOIN Status st ON s.id_status = st.id_status
      ORDER BY s.date_signalement DESC
    `;

    const result = await pool.query(query);
    const signalements = result.rows.map((row: any) => ({
      id: row.id,
      location: row.longitude && row.latitude ? {
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude)
      } : null,
      description: row.description,
      date_signalement: row.date_signalement,
      firebase_id: row.firebase_id,
      est_synchronise: row.est_synchronise,
      user: {
        email: row.email,
        display_name: row.display_name
      },
      status: row.status
    }));

    return { data: signalements, source: 'postgres' };
  }

  /**
   * Synchronise un utilisateur depuis Firebase vers PostgreSQL (cache local)
   * Utilise Firebase Auth - le mot de passe n'est jamais stocké localement
   */
  public async syncUserFromFirebase(data: UserData): Promise<{ uid: string; source: 'firebase' | 'postgres' }> {
    const isOnline = await this.isFirebaseAvailable();

    if (!isOnline) {
      throw new Error('Synchronisation impossible en mode hors ligne');
    }

    console.log('📡 Synchronisation utilisateur depuis Firebase...');

    try {
      // Créer/mettre à jour dans PostgreSQL (cache local)
      const query = `
        INSERT INTO User_ (firebase_uid, email, display_name, id_type_user, date_creation, derniere_sync, est_bloque)
        VALUES ($1, $2, $3, $4, NOW(), NOW(), FALSE)
        ON CONFLICT (firebase_uid) 
        DO UPDATE SET 
          email = EXCLUDED.email,
          display_name = EXCLUDED.display_name,
          derniere_sync = NOW()
        RETURNING id_user
      `;

      const values = [
        data.firebase_uid,
        data.email,
        data.display_name || null,
        data.type_user || 2
      ];

      const result = await pool.query(query, values);
      console.log('✅ Utilisateur synchronisé vers PostgreSQL (cache local)');

      return { uid: result.rows[0].id_user.toString(), source: 'firebase' };
    } catch (error) {
      console.error('❌ Erreur synchronisation utilisateur:', error);
      throw error;
    }
  }

  /**
   * Récupère un utilisateur depuis le cache local par Firebase UID
   */
  public async getUserFromCache(firebaseUid: string): Promise<any | null> {
    try {
      const query = `
        SELECT id_user, firebase_uid, email, display_name, id_type_user, est_bloque, date_creation, derniere_sync
        FROM User_ WHERE firebase_uid = $1
      `;
      const result = await pool.query(query, [firebaseUid]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Erreur récupération utilisateur du cache:', error);
      return null;
    }
  }

  /**
   * Compte les éléments en attente de synchronisation
   */
  public async getSyncStatus(): Promise<{
    pending_signalements: number;
    pending_users: number;
    needs_sync: boolean;
  }> {
    try {
      const signalementResult = await pool.query(
        'SELECT COUNT(*) as count FROM Signalement WHERE est_synchronise = FALSE'
      );

      const userResult = await pool.query(
        'SELECT COUNT(*) as count FROM User_ WHERE firebase_uid IS NULL'
      );

      const pendingSignalements = parseInt(signalementResult.rows[0].count);
      const pendingUsers = parseInt(userResult.rows[0].count);

      return {
        pending_signalements: pendingSignalements,
        pending_users: pendingUsers,
        needs_sync: pendingSignalements > 0 || pendingUsers > 0
      };
    } catch (error) {
      console.error('Erreur lors de la vérification du statut de sync:', error);
      return {
        pending_signalements: 0,
        pending_users: 0,
        needs_sync: false
      };
    }
  }

  /**
   * Retourne le statut complet de Firebase
   */
  public getStatus(): { initialized: boolean; available: boolean; lastCheck: number } {
    return getFirebaseStatus();
  }
}

export const hybridDataService = HybridDataService.getInstance();
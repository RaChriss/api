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
  nom: string;
  prenom: string;
  email: string;
  password?: string;
  type_user_id: number;
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
        u.nom,
        u.prenom,
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
        nom: row.nom,
        prenom: row.prenom
      },
      status: row.status
    }));

    return { data: signalements, source: 'postgres' };
  }

  /**
   * Crée un utilisateur (Firebase ou PostgreSQL selon la connexion)
   */
  public async createUser(data: UserData): Promise<{ uid: string; source: 'firebase' | 'postgres' }> {
    const isOnline = await this.isFirebaseAvailable();
    
    if (isOnline) {
      // Mode online : utiliser Firebase ET PostgreSQL
      console.log('📡 Mode en ligne : création utilisateur Firebase + PostgreSQL');
      
      try {
        // 1. Créer dans PostgreSQL d'abord
        const postgresResult = await this.createUserPostgres(data);
        
        // 2. Créer dans Firebase Auth + Firestore
        try {
          const firebaseUser = await admin.auth().createUser({
            email: data.email,
            displayName: `${data.prenom} ${data.nom}`
          });

          // Créer dans Firestore avec référence PostgreSQL
          await admin.firestore().collection('users').doc(firebaseUser.uid).set({
            nom: data.nom,
            prenom: data.prenom,
            email: data.email,
            type_user_id: data.type_user_id,
            postgres_id: postgresResult.uid,
            date_creation: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // 3. Mettre à jour PostgreSQL avec l'UID Firebase
          await pool.query(
            'UPDATE User_ SET firebase_uid = $1 WHERE id_user = $2',
            [firebaseUser.uid, postgresResult.uid]
          );
          
          console.log('✅ Utilisateur créé dans Firebase + PostgreSQL');
        } catch (firebaseError) {
          console.warn('⚠️ Erreur Firebase Auth (PostgreSQL OK):', (firebaseError as Error).message);
        }
        
        return postgresResult; // Retourner l'ID PostgreSQL
      } catch (error) {
        console.error('❌ Erreur création utilisateur:', error);
        throw error;
      }
    } else {
      // Mode offline : PostgreSQL seulement
      console.log('💾 Mode hors ligne : création utilisateur PostgreSQL uniquement');
      return await this.createUserPostgres(data);
    }
  }

  /**
   * Crée un utilisateur dans PostgreSQL
   */
  private async createUserPostgres(data: UserData): Promise<{ uid: string; source: 'postgres' }> {
    const query = `
      INSERT INTO User_ (nom, prenom, email, password, id_type_user)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id_user
    `;

    const values = [
      data.nom,
      data.prenom,
      data.email,
      data.password || 'temp_password', // À remplacer par un hash
      data.type_user_id
    ];

    const result = await pool.query(query, values);
    return { uid: result.rows[0].id_user.toString(), source: 'postgres' };
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
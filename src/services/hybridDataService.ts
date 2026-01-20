import * as admin from 'firebase-admin';
import { pool } from '../config/database';

interface SignalementData {
  location?: { latitude: number; longitude: number };
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
  private isOnline: boolean = true;
  private connectionCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startConnectionMonitoring();
  }

  public static getInstance(): HybridDataService {
    if (!HybridDataService.instance) {
      HybridDataService.instance = new HybridDataService();
    }
    return HybridDataService.instance;
  }

  /**
   * Démarre la surveillance de la connexion Firebase
   */
  private startConnectionMonitoring(): void {
    // Vérifier la connexion toutes les 30 secondes
    this.connectionCheckInterval = setInterval(async () => {
      await this.checkFirebaseConnection();
    }, 30000);

    // Vérification initiale
    this.checkFirebaseConnection();
  }

  /**
   * Vérifie la connexion Firebase
   */
  private async checkFirebaseConnection(): Promise<void> {
    try {
      await admin.firestore().collection('_health').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      
      if (!this.isOnline) {
        console.log('🟢 Connexion Firebase rétablie');
        this.isOnline = true;
      }
    } catch (error) {
      if (this.isOnline) {
        console.log('🔴 Connexion Firebase perdue, basculement vers PostgreSQL');
        this.isOnline = false;
      }
    }
  }

  /**
   * Retourne l'état de la connexion
   */
  public isFirebaseAvailable(): boolean {
    return this.isOnline;
  }

  /**
   * Crée un signalement (Firebase ou PostgreSQL selon la connexion)
   */
  public async createSignalement(data: SignalementData): Promise<{ id: string; source: 'firebase' | 'postgres' }> {
    if (this.isOnline) {
      try {
        // Essayer Firebase en premier
        const docRef = await admin.firestore().collection('signalements').add({
          location: data.location || null,
          user_id: data.user_id,
          status_id: data.status_id || 1, // Nouveau par défaut
          date_signalement: data.date_signalement || admin.firestore.FieldValue.serverTimestamp(),
          created_online: true
        });

        return { id: docRef.id, source: 'firebase' };
      } catch (error) {
        console.error('Erreur Firebase, basculement vers PostgreSQL:', error);
        this.isOnline = false;
        return await this.createSignalementPostgres(data);
      }
    } else {
      return await this.createSignalementPostgres(data);
    }
  }

  /**
   * Crée un signalement dans PostgreSQL
   */
  private async createSignalementPostgres(data: SignalementData): Promise<{ id: string; source: 'postgres' }> {
    const locationValue = data.location 
      ? `POINT(${data.location.longitude}, ${data.location.latitude})`
      : null;

    const query = `
      INSERT INTO Signalement (location, Id_user, Id_Status, date_signalement, est_synchronise)
      VALUES ($1, $2, $3, $4, FALSE)
      RETURNING Id_Signalement
    `;

    const values = [
      locationValue,
      data.user_id,
      data.status_id || 1,
      data.date_signalement || new Date()
    ];

    const result = await pool.query(query, values);
    return { id: result.rows[0].id_signalement.toString(), source: 'postgres' };
  }

  /**
   * Récupère les signalements (Firebase ou PostgreSQL selon la connexion)
   */
  public async getSignalements(): Promise<{ data: any[]; source: 'firebase' | 'postgres' }> {
    if (this.isOnline) {
      try {
        const snapshot = await admin.firestore().collection('signalements').get();
        const signalements = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        return { data: signalements, source: 'firebase' };
      } catch (error) {
        console.error('Erreur Firebase, basculement vers PostgreSQL:', error);
        this.isOnline = false;
        return await this.getSignalementsPostgres();
      }
    } else {
      return await this.getSignalementsPostgres();
    }
  }

  /**
   * Récupère les signalements depuis PostgreSQL
   */
  private async getSignalementsPostgres(): Promise<{ data: any[]; source: 'postgres' }> {
    const query = `
      SELECT 
        s.Id_Signalement as id,
        ST_X(s.location) as longitude,
        ST_Y(s.location) as latitude,
        s.date_signalement,
        s.firebase_id,
        s.est_synchronise,
        u.email,
        u.nom,
        u.prenom,
        st.libelle as status
      FROM Signalement s
      JOIN User_ u ON s.Id_user = u.Id_user
      JOIN Status st ON s.Id_Status = st.Id_Status
      ORDER BY s.date_signalement DESC
    `;

    const result = await pool.query(query);
    const signalements = result.rows.map(row => ({
      id: row.id,
      location: row.longitude && row.latitude ? {
        latitude: row.latitude,
        longitude: row.longitude
      } : null,
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
    if (this.isOnline) {
      try {
        // Créer dans Firebase Auth
        const firebaseUser = await admin.auth().createUser({
          email: data.email,
          displayName: `${data.prenom} ${data.nom}`
        });

        // Créer dans Firestore
        await admin.firestore().collection('users').doc(firebaseUser.uid).set({
          nom: data.nom,
          prenom: data.prenom,
          email: data.email,
          type_user_id: data.type_user_id,
          date_creation: admin.firestore.FieldValue.serverTimestamp()
        });

        return { uid: firebaseUser.uid, source: 'firebase' };
      } catch (error) {
        console.error('Erreur Firebase, basculement vers PostgreSQL:', error);
        this.isOnline = false;
        return await this.createUserPostgres(data);
      }
    } else {
      return await this.createUserPostgres(data);
    }
  }

  /**
   * Crée un utilisateur dans PostgreSQL
   */
  private async createUserPostgres(data: UserData): Promise<{ uid: string; source: 'postgres' }> {
    const query = `
      INSERT INTO User_ (nom, prenom, email, password, Id_type_user)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING Id_user
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
   * Nettoie les ressources
   */
  public cleanup(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }
  }
}

export const hybridDataService = HybridDataService.getInstance();
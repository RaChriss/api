/**
 * Utilitaires pour la gestion des collections Firebase
 * Fonctions réutilisables pour créer, vider et gérer les collections
 */

import * as admin from 'firebase-admin';
import { getFirestore } from '../config/firebase';

export class FirebaseCollectionManager {
  private db: admin.firestore.Firestore;

  constructor() {
    this.db = getFirestore();
  }

  /**
   * Crée une collection avec des données initiales
   */
  async createCollection<T extends Record<string, any>>(
    collectionName: string,
    documents: Array<{ id: string; data: T }>
  ): Promise<void> {
    console.log(`📁 Création de la collection ${collectionName}...`);
    
    const batch = this.db.batch();
    
    documents.forEach(({ id, data }) => {
      const ref = this.db.collection(collectionName).doc(id);
      batch.set(ref, data);
    });

    await batch.commit();
    console.log(`✅ Collection ${collectionName} créée avec ${documents.length} document(s)`);
  }

  /**
   * Vide complètement une collection
   */
  async clearCollection(collectionName: string): Promise<void> {
    console.log(`🗑️ Vidage de la collection ${collectionName}...`);
    
    const snapshot = await this.db.collection(collectionName).get();
    const batch = this.db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    if (snapshot.size > 0) {
      await batch.commit();
      console.log(`✅ ${snapshot.size} document(s) supprimé(s) de ${collectionName}`);
    } else {
      console.log(`ℹ️ Collection ${collectionName} déjà vide`);
    }
  }

  /**
   * Vérifie si une collection existe et compte ses documents
   */
  async getCollectionInfo(collectionName: string): Promise<{
    exists: boolean;
    documentCount: number;
    documents: string[];
  }> {
    try {
      const snapshot = await this.db.collection(collectionName).get();
      return {
        exists: true,
        documentCount: snapshot.size,
        documents: snapshot.docs.map(doc => doc.id)
      };
    } catch (error) {
      return {
        exists: false,
        documentCount: 0,
        documents: []
      };
    }
  }

  /**
   * Crée toutes les collections de base avec leurs données initiales
   */
  async createAllBaseCollections(): Promise<void> {
    console.log('🚀 Création de toutes les collections de base...');

    // Types d'utilisateurs
    await this.createCollection('TypeUser', [
      { id: 'type_visiteur', data: { libelle: 'Visiteur' } },
      { id: 'type_utilisateur', data: { libelle: 'Utilisateur' } },
      { id: 'type_manager', data: { libelle: 'Manager' } }
    ]);

    // Statuts
    await this.createCollection('Status', [
      { id: 'status_nouveau', data: { libelle: 'Nouveau', couleur: '#FF0000' } },
      { id: 'status_en_cours', data: { libelle: 'En cours', couleur: '#FFA500' } },
      { id: 'status_termine', data: { libelle: 'Terminé', couleur: '#00FF00' } }
    ]);

    // Paramètres
    await this.createCollection('Parametre', [
      {
        id: 'param_visiteur',
        data: {
          nom: 'Paramètres Visiteur',
          limite_tentatives: 3,
          duree_session: 3600,
          id_type_user: 'type_visiteur'
        }
      },
      {
        id: 'param_utilisateur',
        data: {
          nom: 'Paramètres Utilisateur',
          limite_tentatives: 3,
          duree_session: 7200,
          id_type_user: 'type_utilisateur'
        }
      },
      {
        id: 'param_manager',
        data: {
          nom: 'Paramètres Manager',
          limite_tentatives: 5,
          duree_session: 14400,
          id_type_user: 'type_manager'
        }
      }
    ]);

    // Entreprises
    await this.createCollection('Entreprise', [
      {
        id: 'entreprise_municipal',
        data: {
          nom: 'Entreprise Municipal',
          telephone: '+261 20 22 123 45',
          email: 'municipal@antananarivo.mg',
          adresse: 'Antananarivo, Madagascar'
        }
      }
    ]);

    // Utilisateurs par défaut
    await this.createCollection('User_', [
      {
        id: 'user_admin_manager',
        data: {
          nom: 'Admin',
          prenom: 'Manager',
          email: 'manager@travaux.mg',
          password: '$2b$10$N9qo8uLOickgx2ZMRZoMye5jZNvhkVOOYuC7a8h5Ggq.LJaFdW.bO',
          date_creation: admin.firestore.Timestamp.now(),
          est_bloque: false,
          id_type_user: 'type_manager'
        }
      }
    ]);

    console.log('✅ Toutes les collections de base ont été créées!');
  }

  /**
   * Crée les collections dynamiques (vides au départ)
   */
  async createDynamicCollections(): Promise<void> {
    console.log('📁 Création des collections dynamiques...');

    const dynamicCollections = [
      'Signalement',
      'Reparation',
      'HistoriqueStatus',
      'TentativeConnexion',
      'Session'
    ];

    for (const collectionName of dynamicCollections) {
      // Créer un document placeholder pour initialiser la collection
      const ref = this.db.collection(collectionName).doc('_init');
      await ref.set({
        _placeholder: true,
        _created: admin.firestore.Timestamp.now(),
        _description: `Collection ${collectionName} initialisée`
      });
      
      // Supprimer immédiatement le placeholder
      await ref.delete();
      
      console.log(`✅ Collection ${collectionName} initialisée`);
    }
  }

  /**
   * Affiche un résumé de toutes les collections
   */
  async showCollectionsSummary(): Promise<void> {
    console.log('\n📊 RÉSUMÉ DES COLLECTIONS FIREBASE\n');
    
    const collections = [
      'TypeUser', 'Status', 'Parametre', 'Entreprise',
      'User_', 'Signalement', 'Reparation', 'HistoriqueStatus',
      'TentativeConnexion', 'Session'
    ];

    for (const collectionName of collections) {
      const info = await this.getCollectionInfo(collectionName);
      console.log(`📁 ${collectionName.padEnd(20)} : ${info.documentCount} document(s)`);
      
      if (info.documentCount > 0 && info.documentCount <= 10) {
        info.documents.forEach(docId => {
          if (!docId.startsWith('_')) {
            console.log(`   └─ ${docId}`);
          }
        });
      }
    }
    
    console.log('\n✅ Résumé terminé\n');
  }

  /**
   * Réinitialise complètement toutes les collections
   */
  async resetAllCollections(): Promise<void> {
    console.log('⚠️ RÉINITIALISATION COMPLÈTE DES COLLECTIONS...');
    
    const collections = [
      'TypeUser', 'Status', 'Parametre', 'Entreprise',
      'User_', 'Signalement', 'Reparation', 'HistoriqueStatus',
      'TentativeConnexion', 'Session'
    ];

    // Vider toutes les collections
    for (const collectionName of collections) {
      await this.clearCollection(collectionName);
    }

    // Recréer les collections de base
    await this.createAllBaseCollections();
    await this.createDynamicCollections();

    console.log('✅ Réinitialisation complète terminée!');
  }

  /**
   * Ajoute des données d'exemple pour les tests
   */
  async addSampleData(): Promise<void> {
    console.log('📝 Ajout de données d\'exemple...');

    // Ajouter des signalements d'exemple
    await this.createCollection('Signalement', [
      {
        id: 'signalement_1',
        data: {
          description: 'Nid de poule sur la route principale',
          location: new admin.firestore.GeoPoint(-18.8792, 47.5079),
          date_signalement: admin.firestore.Timestamp.now(),
          est_synchronise: true,
          id_user: 'user_admin_manager',
          id_status: 'status_nouveau'
        }
      },
      {
        id: 'signalement_2',
        data: {
          description: 'Affaissement de chaussée',
          location: new admin.firestore.GeoPoint(-18.8800, 47.5090),
          date_signalement: admin.firestore.Timestamp.now(),
          est_synchronise: true,
          id_user: 'user_admin_manager',
          id_status: 'status_en_cours'
        }
      }
    ]);

    // Ajouter une réparation d'exemple
    await this.createCollection('Reparation', [
      {
        id: 'reparation_1',
        data: {
          surface_m2: 15.5,
          budget: 2500000,
          date_debut: admin.firestore.Timestamp.fromDate(new Date()),
          date_fin_prevue: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          commentaire: 'Réparation urgente nécessaire',
          date_creation: admin.firestore.Timestamp.now(),
          id_signalement: 'signalement_1',
          id_entreprise: 'entreprise_municipal',
          id_status: 'status_en_cours',
          id_user: 'user_admin_manager'
        }
      }
    ]);

    console.log('✅ Données d\'exemple ajoutées!');
  }
}

export default FirebaseCollectionManager;
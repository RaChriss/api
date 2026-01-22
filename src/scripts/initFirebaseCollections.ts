/**
 * Script d'initialisation des collections Firebase
 * Crée toutes les collections et documents initiaux basés sur le schéma PostgreSQL
 */

import { initializeFirebase, getFirestore } from '../config/firebase';
import * as admin from 'firebase-admin';

interface TypeUser {
  id: number;
  libelle: string;
}

interface Status {
  id: number;
  libelle: string;
  couleur: string;
}

interface Parametre {
  id: number;
  nom: string;
  valeur: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  date_modification: admin.firestore.Timestamp;
}

interface Entreprise {
  id: number;
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
}

interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  password: string;
  firebase_uid?: string;
  date_creation: admin.firestore.Timestamp;
  est_bloque: boolean;
  id_type_user: number;
}

interface Signalement {
  id: number;
  location: admin.firestore.GeoPoint;
  date_signalement: admin.firestore.Timestamp;
  description?: string;
  firebase_id?: string;
  est_synchronise: boolean;
  id_user: number;
  id_status: number;
}

interface Reparation {
  id: number;
  surface_m2: number;
  budget: number;
  date_debut?: admin.firestore.Timestamp;
  date_fin_prevue?: admin.firestore.Timestamp;
  date_fin_reelle?: admin.firestore.Timestamp;
  commentaire?: string;
  date_creation: admin.firestore.Timestamp;
  date_modification?: admin.firestore.Timestamp;
  id_signalement: number;
  id_entreprise: number;
  id_status: number;
  id_user: number;
}

interface HistoriqueStatus {
  id: number;  // Correspond à Id_Historique SERIAL (INT) dans PostgreSQL
  id_reparation: number;  // Correspond à Id_Reparation INT dans PostgreSQL
  id_status_ancien?: number;  // Correspond à Id_Status INT dans PostgreSQL
  id_status_nouveau: number;  // Correspond à Id_Status INT dans PostgreSQL
  id_user: number;  // Correspond à Id_user INT dans PostgreSQL
  date_modification: admin.firestore.Timestamp;
  commentaire?: string;
}

interface TentativeConnexion {
  id: number;
  email: string;  // Suivi par email (avant authentification)
  ip_address?: string;
  succes: boolean;
  date_tentative: admin.firestore.Timestamp;
  raison_echec?: string;
}

interface Session {
  id: number;
  id_user: number;
  token: string;
  refresh_token?: string;
  date_creation: admin.firestore.Timestamp;
  date_expiration: admin.firestore.Timestamp;
  est_active: boolean;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Initialise toutes les collections Firebase avec des données par défaut
 */
export async function initializeAllFirebaseCollections(): Promise<void> {
  console.log('🚀 Début de l\'initialisation des collections Firebase...');

  try {
    // Vérifier la configuration Firebase avant l'initialisation
    const serviceAccountPath = require('path').join(__dirname, '../../firebase-service-account.json');
    if (!require('fs').existsSync(serviceAccountPath)) {
      throw new Error(`Fichier de configuration manquant: ${serviceAccountPath}`);
    }

    // Initialisation Firebase avec gestion d'erreur
    let firebaseApp;
    try {
      firebaseApp = initializeFirebase();
      if (!firebaseApp) {
        throw new Error('Impossible d\'initialiser Firebase - application nulle');
      }
    } catch (error: any) {
      console.error('❌ Erreur d\'initialisation Firebase:', error.message);
      if (error.message.includes('no configuration corresponding')) {
        console.log('📝 Vérifiez que le project_id dans firebase-service-account.json est correct');
        console.log('📝 Project ID actuel: mapmobile-31594');
      }
      throw error;
    }

    const db = getFirestore();
    const batch = db.batch();

    // 1. Créer les types d'utilisateurs
    console.log('📁 Création de la collection TypeUser...');
    const typeUsersData: TypeUser[] = [
      { id: 1, libelle: 'Visiteur' },
      { id: 2, libelle: 'Utilisateur' },
      { id: 3, libelle: 'Manager' }
    ];

    typeUsersData.forEach(typeUser => {
      const ref = db.collection('TypeUser').doc(typeUser.id.toString());
      batch.set(ref, typeUser);
    });

    // 2. Créer les statuts
    console.log('📁 Création de la collection Status...');
    const statusData: Status[] = [
      { id: 1, libelle: 'Nouveau', couleur: '#FF0000' },
      { id: 2, libelle: 'En cours', couleur: '#FFA500' },
      { id: 3, libelle: 'Terminé', couleur: '#00FF00' }
    ];

    statusData.forEach(status => {
      const ref = db.collection('Status').doc(status.id.toString());
      batch.set(ref, status);
    });

    // 3. Créer les paramètres globaux (structure nom/valeur/type)
    console.log('📁 Création de la collection Parametre...');
    const parametresData: Parametre[] = [
      {
        id: 1,
        nom: 'max_tentatives_connexion',
        valeur: '5',
        type: 'number',
        description: 'Nombre maximum de tentatives de connexion avant blocage',
        date_modification: admin.firestore.Timestamp.now()
      },
      {
        id: 2,
        nom: 'duree_blocage_minutes',
        valeur: '15',
        type: 'number',
        description: 'Durée du blocage après trop de tentatives (en minutes)',
        date_modification: admin.firestore.Timestamp.now()
      },
      {
        id: 3,
        nom: 'session_expiration_heures',
        valeur: '24',
        type: 'number',
        description: 'Durée de validité des sessions (en heures)',
        date_modification: admin.firestore.Timestamp.now()
      },
      {
        id: 4,
        nom: 'refresh_token_expiration_jours',
        valeur: '30',
        type: 'number',
        description: 'Durée de validité des refresh tokens (en jours)',
        date_modification: admin.firestore.Timestamp.now()
      },
      {
        id: 5,
        nom: 'maintenance_mode',
        valeur: 'false',
        type: 'boolean',
        description: 'Mode maintenance activé',
        date_modification: admin.firestore.Timestamp.now()
      },
      {
        id: 6,
        nom: 'app_version',
        valeur: '1.0.0',
        type: 'string',
        description: 'Version actuelle de l\'application',
        date_modification: admin.firestore.Timestamp.now()
      }
    ];

    parametresData.forEach(parametre => {
      const ref = db.collection('Parametre').doc(parametre.id.toString());
      batch.set(ref, parametre);
    });

    // 4. Créer les entreprises
    console.log('📁 Création de la collection Entreprise...');
    const entreprisesData: Entreprise[] = [
      {
        id: 1,
        nom: 'Entreprise Municipal',
        telephone: '+261 20 22 123 45',
        email: 'municipal@antananarivo.mg',
        adresse: 'Antananarivo, Madagascar'
      }
    ];

    entreprisesData.forEach(entreprise => {
      const ref = db.collection('Entreprise').doc(entreprise.id.toString());
      batch.set(ref, entreprise);
    });

    // 5. Créer l'utilisateur Manager par défaut
    console.log('📁 Création de la collection User_...');
    const usersData: User[] = [
      {
        id: 1,
        nom: 'Admin',
        prenom: 'Manager',
        email: 'manager@manager.mg',
        password: 'admin', // Mot de passe en clair
        date_creation: admin.firestore.Timestamp.now(),
        est_bloque: false,
        id_type_user: 3
      }
    ];

    usersData.forEach(user => {
      const ref = db.collection('User_').doc(user.id.toString());
      batch.set(ref, user);
    });

    // Exécuter le batch pour les collections de base
    console.log('💾 Sauvegarde des collections de base...');
    await batch.commit();

    // Créer les collections qui dépendent d'autres collections mais sans données initiales
    // (elles seront remplies dynamiquement par l'application)
    console.log('📁 Création des collections vides...');

    // Collection Signalement (vide)
    const signalementRef = db.collection('Signalement').doc('_placeholder');
    await signalementRef.set({
      _placeholder: true,
      _created: admin.firestore.Timestamp.now(),
      _description: 'Collection créée - ce document sera supprimé automatiquement'
    });

    // Collection Reparation (vide)
    const reparationRef = db.collection('Reparation').doc('_placeholder');
    await reparationRef.set({
      _placeholder: true,
      _created: admin.firestore.Timestamp.now(),
      _description: 'Collection créée - ce document sera supprimé automatiquement'
    });

    // Collection HistoriqueStatus (vide)
    const historiqueRef = db.collection('HistoriqueStatus').doc('_placeholder');
    await historiqueRef.set({
      _placeholder: true,
      _created: admin.firestore.Timestamp.now(),
      _description: 'Collection créée - ce document sera supprimé automatiquement'
    });

    // Collection TentativeConnexion (vide)
    const tentativeRef = db.collection('TentativeConnexion').doc('_placeholder');
    await tentativeRef.set({
      _placeholder: true,
      _created: admin.firestore.Timestamp.now(),
      _description: 'Collection créée - ce document sera supprimé automatiquement'
    });

    // Collection Session (vide)
    const sessionRef = db.collection('Session').doc('_placeholder');
    await sessionRef.set({
      _placeholder: true,
      _created: admin.firestore.Timestamp.now(),
      _description: 'Collection créée - ce document sera supprimé automatiquement'
    });

    console.log('✅ Toutes les collections Firebase ont été créées avec succès!');
    console.log('\n📋 Collections créées:');
    console.log('  - TypeUser (3 documents)');
    console.log('  - Status (3 documents)');
    console.log('  - Parametre (6 documents: max_tentatives, duree_blocage, session_expiration, etc.)');
    console.log('  - Entreprise (1 document)');
    console.log('  - User_ (1 document manager)');
    console.log('  - Signalement (vide)');
    console.log('  - Reparation (vide)');
    console.log('  - HistoriqueStatus (vide)');
    console.log('  - TentativeConnexion (vide - suivi par email)');
    console.log('  - Session (vide - avec refresh_token, ip_address, user_agent)');

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des collections:', error);
    throw error;
  }
}

/**
 * Supprime tous les documents placeholder créés
 */
export async function removePlaceholders(): Promise<void> {
  console.log('🧹 Suppression des documents placeholder...');

  try {
    const db = getFirestore();
    const collections = ['Signalement', 'Reparation', 'HistoriqueStatus', 'TentativeConnexion', 'Session'];

    for (const collectionName of collections) {
      const placeholderRef = db.collection(collectionName).doc('_placeholder');
      const doc = await placeholderRef.get();
      if (doc.exists) {
        await placeholderRef.delete();
        console.log(`  ✅ Placeholder supprimé de ${collectionName}`);
      }
    }

    console.log('✅ Tous les placeholders ont été supprimés');
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des placeholders:', error);
  }
}

/**
 * Vérifie l'état des collections Firebase
 */
export async function checkFirebaseCollections(): Promise<void> {
  console.log('🔍 Vérification des collections Firebase...');

  try {
    const db = getFirestore();
    const collections = [
      'TypeUser', 'Status', 'Parametre', 'Entreprise',
      'User_', 'Signalement', 'Reparation', 'HistoriqueStatus',
      'TentativeConnexion', 'Session'
    ];

    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      console.log(`  📁 ${collectionName}: ${snapshot.size} document(s)`);

      if (snapshot.size > 0) {
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!data._placeholder) {
            console.log(`    - ${doc.id}`);
          }
        });
      }
    }

    console.log('✅ Vérification terminée');
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  }
}

/**
 * Fonction principale pour l'initialisation
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'init';

  switch (command) {
    case 'init':
      await initializeAllFirebaseCollections();
      break;
    case 'check':
      await checkFirebaseCollections();
      break;
    case 'clean':
      await removePlaceholders();
      break;
    default:
      console.log('Usage: npm run firebase-init [init|check|clean]');
      console.log('  init  - Initialise toutes les collections');
      console.log('  check - Vérifie l\'état des collections');
      console.log('  clean - Supprime les documents placeholder');
      process.exit(1);
  }

  process.exit(0);
}

// Exécuter seulement si ce fichier est lancé directement
if (require.main === module) {
  main().catch(console.error);
}
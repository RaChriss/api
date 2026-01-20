import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Initialise Firebase Admin SDK
 * Requiert un fichier firebase-service-account.json à la racine du projet API
 */
export function initializeFirebase() {
  try {
    // Vérifier si Firebase est déjà initialisé
    try {
      const existingApp = admin.app();
      if (existingApp) {
        console.log('✅ Firebase Admin SDK déjà initialisé');
        return existingApp;
      }
    } catch (error: any) {
      // L'app n'existe pas encore, on peut continuer l'initialisation
    }

    // Chemin vers le fichier de clé de service
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');

    // Vérifie si le fichier existe
    if (!fs.existsSync(serviceAccountPath)) {
      console.warn('⚠️  Firebase service account key not found at:', serviceAccountPath);
      console.warn('📋 Please download your service account key from Firebase Console');
      console.warn('Steps:');
      console.warn('1. Go to Firebase Console > Settings > Service Accounts');
      console.warn('2. Click "Generate New Private Key"');
      console.warn('3. Save the JSON file as "firebase-service-account.json" in the api folder');
      return null;
    }

    // Initialise Firebase Admin
    const serviceAccount = require(serviceAccountPath);

    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
    return app;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error);
    return null;
  }
}

/**
 * Obtient l'instance Firebase Admin
 */
export function getFirebaseApp() {
  return admin;
}

/**
 * Obtient la base de données Firestore
 */
export function getFirestore() {
  return admin.firestore();
}

/**
 * Obtient le service d'authentification Firebase
 */
export function getAuth() {
  return admin.auth();
}

/**
 * Obtient le service de réaltime database (si configuré)
 */
export function getDatabase() {
  return admin.database();
}

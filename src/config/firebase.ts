import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// État global de Firebase
let firebaseInitialized = false;
let firebaseAvailable = false;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 30000; // 30 secondes

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
        firebaseInitialized = true;
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

    // Initialise Firebase Admin (sans vérifier la connexion)
    const serviceAccount = require(serviceAccountPath);

    // Configuration avec désactivation de la validation automatique
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialisé (mode hybride activé)');
    
    // Vérifier la connexion en arrière-plan (sans bloquer)
    checkFirebaseConnectionAsync();
    
    return app;
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error);
    return null;
  }
}

/**
 * Vérifie la connexion Firebase de manière asynchrone (non-bloquante)
 */
async function checkFirebaseConnectionAsync(): Promise<void> {
  try {
    // Test simple de connexion Firestore
    const testDoc = admin.firestore().collection('_health').doc('ping');
    await testDoc.set({ 
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: 'api-server'
    }, { merge: true });
    
    if (!firebaseAvailable) {
      console.log('🟢 Firebase connecté (mode en ligne)');
    }
    firebaseAvailable = true;
    lastConnectionCheck = Date.now();
  } catch (error: any) {
    // Mode silencieux - pas de log d'erreur pour éviter la pollution des logs
    if (firebaseAvailable) {
      console.log('🟠 Firebase non disponible (mode hors-ligne activé)');
    }
    firebaseAvailable = false;
    lastConnectionCheck = Date.now();
  }
}

/**
 * Vérifie si Firebase est disponible (avec cache de 30 secondes)
 */
export async function isFirebaseOnline(): Promise<boolean> {
  if (!firebaseInitialized) {
    return false;
  }
  
  // Utiliser le cache si la dernière vérification est récente
  const now = Date.now();
  if (now - lastConnectionCheck < CONNECTION_CHECK_INTERVAL) {
    return firebaseAvailable;
  }
  
  // Vérification en arrière-plan
  checkFirebaseConnectionAsync();
  return firebaseAvailable;
}

/**
 * Retourne l'état actuel de Firebase (sans nouvelle vérification)
 */
export function getFirebaseStatus(): { initialized: boolean; available: boolean; lastCheck: number } {
  return {
    initialized: firebaseInitialized,
    available: firebaseAvailable,
    lastCheck: lastConnectionCheck
  };
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

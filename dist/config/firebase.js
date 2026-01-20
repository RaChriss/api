"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeFirebase = initializeFirebase;
exports.isFirebaseOnline = isFirebaseOnline;
exports.getFirebaseStatus = getFirebaseStatus;
exports.getFirebaseApp = getFirebaseApp;
exports.getFirestore = getFirestore;
exports.getAuth = getAuth;
exports.getDatabase = getDatabase;
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// État global de Firebase
let firebaseInitialized = false;
let firebaseAvailable = false;
let lastConnectionCheck = 0;
const CONNECTION_CHECK_INTERVAL = 30000; // 30 secondes
/**
 * Initialise Firebase Admin SDK
 * Requiert un fichier firebase-service-account.json à la racine du projet API
 */
function initializeFirebase() {
    try {
        // Vérifier si Firebase est déjà initialisé
        try {
            const existingApp = admin.app();
            if (existingApp) {
                firebaseInitialized = true;
                console.log('✅ Firebase Admin SDK déjà initialisé');
                return existingApp;
            }
        }
        catch (error) {
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
    }
    catch (error) {
        console.error('❌ Error initializing Firebase Admin:', error);
        return null;
    }
}
/**
 * Vérifie la connexion Firebase de manière asynchrone (non-bloquante)
 */
async function checkFirebaseConnectionAsync() {
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
    }
    catch (error) {
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
async function isFirebaseOnline() {
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
function getFirebaseStatus() {
    return {
        initialized: firebaseInitialized,
        available: firebaseAvailable,
        lastCheck: lastConnectionCheck
    };
}
/**
 * Obtient l'instance Firebase Admin
 */
function getFirebaseApp() {
    return admin;
}
/**
 * Obtient la base de données Firestore
 */
function getFirestore() {
    return admin.firestore();
}
/**
 * Obtient le service d'authentification Firebase
 */
function getAuth() {
    return admin.auth();
}
/**
 * Obtient le service de réaltime database (si configuré)
 */
function getDatabase() {
    return admin.database();
}
//# sourceMappingURL=firebase.js.map
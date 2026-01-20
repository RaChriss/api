import * as admin from 'firebase-admin';
/**
 * Initialise Firebase Admin SDK
 * Requiert un fichier firebase-service-account.json à la racine du projet API
 */
export declare function initializeFirebase(): admin.app.App | null;
/**
 * Obtient l'instance Firebase Admin
 */
export declare function getFirebaseApp(): typeof admin;
/**
 * Obtient la base de données Firestore
 */
export declare function getFirestore(): admin.firestore.Firestore;
/**
 * Obtient le service d'authentification Firebase
 */
export declare function getAuth(): import("firebase-admin/lib/auth/auth").Auth;
/**
 * Obtient le service de réaltime database (si configuré)
 */
export declare function getDatabase(): import("firebase-admin/lib/database/database").Database;
//# sourceMappingURL=firebase.d.ts.map
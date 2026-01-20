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
const express_1 = require("express");
const admin = __importStar(require("firebase-admin"));
const router = (0, express_1.Router)();
/**
 * POST /api/firebase/verify-token
 * Vérifie un token Firebase et retourne les données utilisateur
 */
router.post('/verify-token', async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            res.status(400).json({
                error: 'ID token is required'
            });
            return;
        }
        // Vérifie le token Firebase
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        res.status(200).json({
            success: true,
            user: {
                uid: decodedToken.uid,
                email: decodedToken.email,
                name: decodedToken.name,
                emailVerified: decodedToken.email_verified,
                issuedAtTime: decodedToken.iat
            }
        });
    }
    catch (error) {
        console.error('Firebase token verification error:', error);
        res.status(401).json({
            error: 'Invalid or expired token',
            details: error.message
        });
    }
});
/**
 * POST /api/firebase/create-user
 * Crée un utilisateur dans Firebase Authentication
 */
router.post('/create-user', async (req, res) => {
    try {
        const { email, password, displayName, phoneNumber } = req.body;
        if (!email || !password) {
            res.status(400).json({
                error: 'Email and password are required'
            });
            return;
        }
        // Crée l'utilisateur dans Firebase Auth
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName,
            phoneNumber
        });
        res.status(201).json({
            success: true,
            user: {
                uid: userRecord.uid,
                email: userRecord.email,
                displayName: userRecord.displayName,
                phoneNumber: userRecord.phoneNumber,
                createdAt: userRecord.metadata.creationTime
            }
        });
    }
    catch (error) {
        console.error('Firebase user creation error:', error);
        res.status(400).json({
            error: 'Failed to create user',
            details: error.message
        });
    }
});
/**
 * POST /api/firebase/sync-signalement
 * Synchronise un signalement de PostgreSQL vers Firestore
 */
router.post('/sync-signalement', async (req, res) => {
    try {
        const { id_signalement, id_user, description, gps_lat, gps_lng, photo_url, date_creation } = req.body;
        if (!id_signalement || !id_user) {
            res.status(400).json({
                error: 'id_signalement and id_user are required'
            });
            return;
        }
        // Ajoute le signalement à Firestore
        const signalementRef = admin.firestore().collection('signalements').doc(id_signalement.toString());
        await signalementRef.set({
            id_signalement,
            id_user,
            description,
            location: new admin.firestore.GeoPoint(gps_lat, gps_lng),
            photoUrl: photo_url,
            timestamp: admin.firestore.Timestamp.fromDate(new Date(date_creation || new Date())),
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'new'
        }, { merge: true });
        res.status(200).json({
            success: true,
            message: 'Signalement synchronized to Firestore',
            documentId: id_signalement
        });
    }
    catch (error) {
        console.error('Firestore sync error:', error);
        res.status(400).json({
            error: 'Failed to sync signalement',
            details: error.message
        });
    }
});
/**
 * GET /api/firebase/signalements
 * Récupère tous les signalements depuis Firestore
 */
router.get('/signalements', async (req, res) => {
    try {
        const snapshot = await admin.firestore().collection('signalements').get();
        const signalements = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        res.status(200).json({
            success: true,
            count: signalements.length,
            signalements
        });
    }
    catch (error) {
        console.error('Firestore query error:', error);
        res.status(400).json({
            error: 'Failed to fetch signalements',
            details: error.message
        });
    }
});
/**
 * GET /api/firebase/signalements/:id
 * Récupère un signalement spécifique depuis Firestore
 */
router.get('/signalements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await admin.firestore().collection('signalements').doc(id).get();
        if (!doc.exists) {
            res.status(404).json({
                error: 'Signalement not found'
            });
            return;
        }
        res.status(200).json({
            success: true,
            signalement: {
                id: doc.id,
                ...doc.data()
            }
        });
    }
    catch (error) {
        console.error('Firestore query error:', error);
        res.status(400).json({
            error: 'Failed to fetch signalement',
            details: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=firebase.js.map
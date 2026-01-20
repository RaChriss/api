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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const userService_1 = __importDefault(require("../services/userService"));
const loginAttemptService_1 = __importDefault(require("../services/loginAttemptService"));
const sessionService_1 = __importDefault(require("../services/sessionService"));
const firebase_1 = require("../config/firebase");
const userTypes_1 = require("../utils/userTypes");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Inscription d'un nouvel utilisateur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nom
 *               - email
 *               - password
 *             properties:
 *               nom:
 *                 type: string
 *                 example: "Rakoto"
 *               prenom:
 *                 type: string
 *                 example: "Jean"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jean.rakoto@email.mg"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "motdepasse123"
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         description: Données invalides
 *       409:
 *         description: Email déjà utilisé
 */
router.post('/register', [
    (0, express_validator_1.body)('nom').notEmpty().withMessage('Le nom est requis'),
    (0, express_validator_1.body)('email').isEmail().withMessage('Email invalide'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères')
], async (req, res) => {
    try {
        // Validation des entrées
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                errors: errors.array()
            });
            return;
        }
        const { nom, prenom, email, password } = req.body;
        // Vérifier si l'email existe déjà
        const existingUser = await userService_1.default.findByEmail(email);
        if (existingUser) {
            res.status(409).json({
                success: false,
                error: 'Cet email est déjà utilisé'
            });
            return;
        }
        // Créer l'utilisateur dans PostgreSQL
        const user = await userService_1.default.create({
            nom,
            prenom,
            email,
            password,
            id_type_user: 2 // Utilisateur par défaut
        });
        // Essayer de créer l'utilisateur dans Firebase (si connecté)
        try {
            const auth = (0, firebase_1.getAuth)();
            const firebaseUser = await auth.createUser({
                email,
                password,
                displayName: `${prenom || ''} ${nom}`.trim()
            });
            // Mettre à jour le firebase_uid dans PostgreSQL
            await userService_1.default.updateFirebaseUid(user.id_user, firebaseUser.uid);
            console.log('✅ Utilisateur créé dans Firebase:', firebaseUser.uid);
        }
        catch (firebaseError) {
            console.warn('⚠️ Création Firebase échouée (mode hors-ligne):', firebaseError.message);
            // Continuer même si Firebase échoue
        }
        res.status(201).json({
            success: true,
            message: 'Utilisateur créé avec succès',
            user: {
                id: user.id_user,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                date_creation: user.date_creation
            }
        });
    }
    catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'inscription',
            details: error.message
        });
    }
});
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion d'un utilisateur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "manager@travaux.mg"
 *               password:
 *                 type: string
 *                 example: "admin123"
 *     responses:
 *       200:
 *         description: Connexion réussie
 *       401:
 *         description: Identifiants invalides
 *       403:
 *         description: Compte bloqué
 */
router.post('/login', [
    (0, express_validator_1.body)('email').isEmail().withMessage('Email invalide'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Mot de passe requis')
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({
                success: false,
                errors: errors.array()
            });
            return;
        }
        const { email, password } = req.body;
        const clientIp = req.ip || req.socket.remoteAddress;
        // Trouver l'utilisateur
        const user = await userService_1.default.findByEmail(email);
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Email ou mot de passe incorrect'
            });
            return;
        }
        // Vérifier si l'utilisateur est bloqué
        if (user.est_bloque) {
            res.status(403).json({
                success: false,
                error: 'Votre compte est bloqué. Contactez un administrateur.'
            });
            return;
        }
        // Vérifier le mot de passe
        const isValidPassword = await userService_1.default.verifyPassword(user, password);
        if (!isValidPassword) {
            // Enregistrer la tentative échouée
            await loginAttemptService_1.default.recordAttempt(user.id_user, false, clientIp);
            // Vérifier si l'utilisateur doit être bloqué
            const shouldBlock = await loginAttemptService_1.default.shouldBlockUser(user.id_user, user.id_type_user);
            if (shouldBlock) {
                await userService_1.default.blockUser(user.id_user);
                res.status(403).json({
                    success: false,
                    error: 'Trop de tentatives échouées. Votre compte a été bloqué.'
                });
                return;
            }
            // Obtenir le nombre de tentatives restantes
            const failedAttempts = await loginAttemptService_1.default.getRecentFailedAttempts(user.id_user);
            const limit = await loginAttemptService_1.default.getAttemptLimit(user.id_type_user);
            const remaining = limit - failedAttempts;
            res.status(401).json({
                success: false,
                error: 'Email ou mot de passe incorrect',
                tentatives_restantes: remaining
            });
            return;
        }
        // Connexion réussie - enregistrer la tentative
        await loginAttemptService_1.default.recordAttempt(user.id_user, true, clientIp);
        // Obtenir la durée de session pour ce type d'utilisateur
        const sessionDuration = await sessionService_1.default.getSessionDuration(user.id_type_user);
        // Créer une session
        const session = await sessionService_1.default.createSession(user.id_user, sessionDuration);
        res.status(200).json({
            success: true,
            message: 'Connexion réussie',
            user: {
                id: user.id_user,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                type_user: user.id_type_user,
                type_user_name: (0, userTypes_1.getUserTypeName)(user.id_type_user)
            },
            session: {
                token: session.token,
                expires_at: session.date_expiration
            }
        });
    }
    catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la connexion',
            details: error.message
        });
    }
});
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Déconnexion de l'utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 */
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            await sessionService_1.default.invalidateSession(token);
        }
        res.status(200).json({
            success: true,
            message: 'Déconnexion réussie'
        });
    }
    catch (error) {
        console.error('Erreur logout:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la déconnexion'
        });
    }
});
/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obtenir les informations de l'utilisateur connecté
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informations utilisateur
 *       401:
 *         description: Non authentifié
 */
router.get('/me', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Token manquant'
            });
            return;
        }
        // Vérifier la session
        const session = await sessionService_1.default.getSessionByToken(token);
        if (!session) {
            res.status(401).json({
                success: false,
                error: 'Session invalide ou expirée'
            });
            return;
        }
        // Obtenir l'utilisateur
        const user = await userService_1.default.findById(session.id_user);
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
            return;
        }
        res.status(200).json({
            success: true,
            user: {
                id: user.id_user,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                firebase_uid: user.firebase_uid,
                date_creation: user.date_creation,
                type_user: user.id_type_user,
                type_user_name: (0, userTypes_1.getUserTypeName)(user.id_type_user),
                est_bloque: user.est_bloque
            },
            session: {
                expires_at: session.date_expiration
            }
        });
    }
    catch (error) {
        console.error('Erreur get me:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/auth/update:
 *   put:
 *     summary: Modifier les informations de l'utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:
 *                 type: string
 *               prenom:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour
 *       401:
 *         description: Non authentifié
 */
router.put('/update', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Token manquant'
            });
            return;
        }
        // Vérifier la session
        const session = await sessionService_1.default.getSessionByToken(token);
        if (!session) {
            res.status(401).json({
                success: false,
                error: 'Session invalide ou expirée'
            });
            return;
        }
        const { nom, prenom, email, password } = req.body;
        // Vérifier si le nouvel email est déjà utilisé
        if (email) {
            const existingUser = await userService_1.default.findByEmail(email);
            if (existingUser && existingUser.id_user !== session.id_user) {
                res.status(409).json({
                    success: false,
                    error: 'Cet email est déjà utilisé'
                });
                return;
            }
        }
        // Mettre à jour l'utilisateur
        const updatedUser = await userService_1.default.update(session.id_user, {
            nom,
            prenom,
            email,
            password
        });
        if (!updatedUser) {
            res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Informations mises à jour',
            user: {
                id: updatedUser.id_user,
                nom: updatedUser.nom,
                prenom: updatedUser.prenom,
                email: updatedUser.email,
                date_creation: updatedUser.date_creation
            }
        });
    }
    catch (error) {
        console.error('Erreur update:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour',
            details: error.message
        });
    }
});
/**
 * @swagger
 * /api/auth/verify-session:
 *   get:
 *     summary: Vérifier si une session est valide
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session valide
 *       401:
 *         description: Session invalide
 */
router.get('/verify-session', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            res.status(401).json({
                success: false,
                valid: false,
                error: 'Token manquant'
            });
            return;
        }
        const isValid = await sessionService_1.default.isSessionValid(token);
        if (!isValid) {
            res.status(401).json({
                success: false,
                valid: false,
                error: 'Session invalide ou expirée'
            });
            return;
        }
        res.status(200).json({
            success: true,
            valid: true
        });
    }
    catch (error) {
        console.error('Erreur verify-session:', error);
        res.status(500).json({
            success: false,
            valid: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/auth/user-types:
 *   get:
 *     summary: Obtenir tous les types d'utilisateurs
 *     tags: [Authentification]
 *     responses:
 *       200:
 *         description: Liste des types d'utilisateurs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 userTypes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 */
router.get('/user-types', async (req, res) => {
    try {
        const { getAllUserTypes } = await Promise.resolve().then(() => __importStar(require('../utils/userTypes')));
        const userTypes = getAllUserTypes();
        res.status(200).json({
            success: true,
            userTypes
        });
    }
    catch (error) {
        console.error('Erreur get user types:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/auth/user-types/{id}:
 *   get:
 *     summary: Obtenir un type d'utilisateur par son ID
 *     tags: [Authentification]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du type d'utilisateur
 *     responses:
 *       200:
 *         description: Informations du type d'utilisateur
 *       404:
 *         description: Type d'utilisateur non trouvé
 */
router.get('/user-types/:id', async (req, res) => {
    try {
        const typeId = parseInt(req.params.id);
        if (isNaN(typeId)) {
            res.status(400).json({
                success: false,
                error: 'ID de type invalide'
            });
            return;
        }
        const { getUserTypeById } = await Promise.resolve().then(() => __importStar(require('../utils/userTypes')));
        const userType = getUserTypeById(typeId);
        if (!userType) {
            res.status(404).json({
                success: false,
                error: 'Type d\'utilisateur non trouvé'
            });
            return;
        }
        res.status(200).json({
            success: true,
            userType
        });
    }
    catch (error) {
        console.error('Erreur get user type by id:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map
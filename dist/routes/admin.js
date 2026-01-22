"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userService_1 = __importDefault(require("../services/userService"));
const hybridDataService_1 = require("../services/hybridDataService");
const auth_1 = require("../middleware/auth");
const firebase_1 = require("../config/firebase");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/admin/users/blocked:
 *   get:
 *     summary: Liste des utilisateurs bloqués
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs bloqués
 *       403:
 *         description: Accès refusé (Manager uniquement)
 */
router.get('/users/blocked', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const blockedUsers = await userService_1.default.getBlockedUsers();
        res.status(200).json({
            success: true,
            count: blockedUsers.length,
            users: blockedUsers.map(user => ({
                id: user.id_user,
                firebase_uid: user.firebase_uid,
                email: user.email,
                display_name: user.display_name,
                date_creation: user.date_creation,
                type_user: user.id_type_user
            }))
        });
    }
    catch (error) {
        console.error('Erreur liste bloqués:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/admin/users/{id}/unblock:
 *   post:
 *     summary: Débloquer un utilisateur
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de l'utilisateur à débloquer
 *     responses:
 *       200:
 *         description: Utilisateur débloqué
 *       404:
 *         description: Utilisateur non trouvé
 *       403:
 *         description: Accès refusé (Manager uniquement)
 */
router.post('/users/:id/unblock', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) {
            res.status(400).json({
                success: false,
                error: 'ID utilisateur invalide'
            });
            return;
        }
        // Vérifier que l'utilisateur existe
        const user = await userService_1.default.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
            return;
        }
        // Débloquer l'utilisateur localement
        await userService_1.default.unblockUser(userId);
        // Débloquer aussi dans Firestore si en ligne
        const isOnline = await hybridDataService_1.hybridDataService.isFirebaseAvailable();
        if (isOnline && user.firebase_uid) {
            try {
                const db = (0, firebase_1.getFirestore)();
                await db.collection('User_').doc(user.firebase_uid).update({
                    est_bloque: false
                });
                console.log(`✅ Utilisateur débloqué dans Firestore: ${user.email}`);
            }
            catch (firebaseError) {
                console.warn('⚠️ Erreur déblocage Firestore:', firebaseError.message);
            }
        }
        res.status(200).json({
            success: true,
            message: `Utilisateur ${user.email} débloqué avec succès`,
            user: {
                id: user.id_user,
                firebase_uid: user.firebase_uid,
                email: user.email,
                display_name: user.display_name
            }
        });
    }
    catch (error) {
        console.error('Erreur déblocage:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du déblocage'
        });
    }
});
/**
 * @swagger
 * /api/admin/users/{id}/block:
 *   post:
 *     summary: Bloquer un utilisateur
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Utilisateur bloqué
 *       404:
 *         description: Utilisateur non trouvé
 */
router.post('/users/:id/block', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) {
            res.status(400).json({
                success: false,
                error: 'ID utilisateur invalide'
            });
            return;
        }
        const user = await userService_1.default.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
            return;
        }
        // Bloquer l'utilisateur localement
        await userService_1.default.blockUser(userId);
        // Bloquer aussi dans Firestore si en ligne
        const isOnline = await hybridDataService_1.hybridDataService.isFirebaseAvailable();
        if (isOnline && user.firebase_uid) {
            try {
                const db = (0, firebase_1.getFirestore)();
                await db.collection('User_').doc(user.firebase_uid).update({
                    est_bloque: true
                });
                console.log(`✅ Utilisateur bloqué dans Firestore: ${user.email}`);
            }
            catch (firebaseError) {
                console.warn('⚠️ Erreur blocage Firestore:', firebaseError.message);
            }
        }
        res.status(200).json({
            success: true,
            message: `Utilisateur ${user.email} bloqué avec succès`
        });
    }
    catch (error) {
        console.error('Erreur blocage:', error);
        // Gestion spécifique de l'erreur des managers
        if (error.message?.includes('managers ne peuvent pas être bloqués')) {
            res.status(403).json({
                success: false,
                error: 'Les managers ne peuvent pas être bloqués'
            });
            return;
        }
        res.status(500).json({
            success: false,
            error: 'Erreur lors du blocage'
        });
    }
});
/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Liste de tous les utilisateurs
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 */
router.get('/users', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const users = await userService_1.default.findAll();
        res.status(200).json({
            success: true,
            count: users.length,
            users: users.map(user => ({
                id: user.id_user,
                firebase_uid: user.firebase_uid,
                email: user.email,
                display_name: user.display_name,
                date_creation: user.date_creation,
                derniere_sync: user.derniere_sync,
                est_bloque: user.est_bloque,
                type_user: user.id_type_user,
                type_libelle: user.type_libelle
            }))
        });
    }
    catch (error) {
        console.error('Erreur liste users:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/admin/users/{id}/update-type:
 *   put:
 *     summary: Modifier le type d'un utilisateur
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type_user
 *             properties:
 *               type_user:
 *                 type: integer
 *                 description: 1=Visiteur, 2=Utilisateur, 3=Manager
 *     responses:
 *       200:
 *         description: Type utilisateur mis à jour
 *       404:
 *         description: Utilisateur non trouvé
 */
router.put('/users/:id/update-type', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const { type_user } = req.body;
        if (isNaN(userId)) {
            res.status(400).json({
                success: false,
                error: 'ID utilisateur invalide'
            });
            return;
        }
        if (!type_user || ![1, 2, 3].includes(type_user)) {
            res.status(400).json({
                success: false,
                error: 'Type utilisateur invalide (1=Visiteur, 2=Utilisateur, 3=Manager)'
            });
            return;
        }
        const user = await userService_1.default.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
            return;
        }
        // Mettre à jour le type localement
        await userService_1.default.update(userId, { type_user });
        // Mettre à jour aussi dans Firestore si en ligne
        const isOnline = await hybridDataService_1.hybridDataService.isFirebaseAvailable();
        if (isOnline && user.firebase_uid) {
            try {
                const db = (0, firebase_1.getFirestore)();
                await db.collection('User_').doc(user.firebase_uid).update({
                    type_user
                });
                console.log(`✅ Type utilisateur mis à jour dans Firestore: ${user.email}`);
            }
            catch (firebaseError) {
                console.warn('⚠️ Erreur mise à jour Firestore:', firebaseError.message);
            }
        }
        res.status(200).json({
            success: true,
            message: `Type utilisateur mis à jour pour ${user.email}`,
            user: {
                id: user.id_user,
                firebase_uid: user.firebase_uid,
                email: user.email,
                type_user
            }
        });
    }
    catch (error) {
        console.error('Erreur update type:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour'
        });
    }
});
/**
 * @swagger
 * /api/admin/sync/status:
 *   get:
 *     summary: Statut de la synchronisation Firebase
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statut de synchronisation
 */
router.get('/sync/status', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const syncStatus = await hybridDataService_1.hybridDataService.getSyncStatus();
        const isFirebaseConnected = hybridDataService_1.hybridDataService.isFirebaseAvailableSync();
        res.status(200).json({
            success: true,
            firebase_connected: isFirebaseConnected,
            ...syncStatus,
            current_mode: isFirebaseConnected ? 'firebase' : 'postgres'
        });
    }
    catch (error) {
        console.error('Erreur statut sync:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/admin/sync/users:
 *   post:
 *     summary: Synchroniser tous les utilisateurs vers Firebase
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Synchronisation effectuée
 */
router.post('/sync/users', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const isOnline = await hybridDataService_1.hybridDataService.isFirebaseAvailable();
        if (!isOnline) {
            res.status(503).json({
                success: false,
                error: 'Firebase non disponible. Synchronisation impossible.'
            });
            return;
        }
        const db = (0, firebase_1.getFirestore)();
        const localUsers = await userService_1.default.findAll();
        let synced = 0;
        let errors = 0;
        for (const user of localUsers) {
            try {
                // Skip users without firebase_uid (created offline only)
                if (!user.firebase_uid) {
                    console.log(`⏭️ Skip sync user ${user.email} (pas de firebase_uid)`);
                    continue;
                }
                await db.collection('User_').doc(user.firebase_uid).set({
                    firebase_uid: user.firebase_uid,
                    email: user.email,
                    display_name: user.display_name,
                    type_user: user.id_type_user,
                    est_bloque: user.est_bloque,
                    date_creation: user.date_creation
                }, { merge: true });
                synced++;
            }
            catch (err) {
                console.warn(`⚠️ Erreur sync user ${user.email}:`, err.message);
                errors++;
            }
        }
        res.status(200).json({
            success: true,
            message: 'Synchronisation utilisateurs terminée',
            stats: {
                total: localUsers.length,
                synced,
                errors
            }
        });
    }
    catch (error) {
        console.error('Erreur synchronisation users:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la synchronisation'
        });
    }
});
/**
 * @swagger
 * /api/admin/firebase/users:
 *   get:
 *     summary: Liste des utilisateurs Firebase Auth
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs Firebase
 */
router.get('/firebase/users', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const isOnline = await hybridDataService_1.hybridDataService.isFirebaseAvailable();
        if (!isOnline) {
            res.status(503).json({
                success: false,
                error: 'Firebase non disponible'
            });
            return;
        }
        const auth = (0, firebase_1.getAuth)();
        const listResult = await auth.listUsers(100);
        res.status(200).json({
            success: true,
            count: listResult.users.length,
            users: listResult.users.map(user => ({
                uid: user.uid,
                email: user.email,
                display_name: user.displayName,
                email_verified: user.emailVerified,
                disabled: user.disabled,
                created_at: user.metadata.creationTime
            }))
        });
    }
    catch (error) {
        console.error('Erreur liste Firebase users:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/admin/firebase/users/{uid}/disable:
 *   post:
 *     summary: Désactiver un utilisateur Firebase Auth
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Utilisateur désactivé
 */
router.post('/firebase/users/:uid/disable', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const { uid } = req.params;
        const isOnline = await hybridDataService_1.hybridDataService.isFirebaseAvailable();
        if (!isOnline) {
            res.status(503).json({
                success: false,
                error: 'Firebase non disponible'
            });
            return;
        }
        const auth = (0, firebase_1.getAuth)();
        await auth.updateUser(uid, { disabled: true });
        // Aussi bloquer localement
        await userService_1.default.blockUserByFirebaseUid(uid);
        res.status(200).json({
            success: true,
            message: 'Utilisateur Firebase désactivé'
        });
    }
    catch (error) {
        console.error('Erreur disable Firebase user:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/admin/firebase/users/{uid}/enable:
 *   post:
 *     summary: Réactiver un utilisateur Firebase Auth
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Utilisateur réactivé
 */
router.post('/firebase/users/:uid/enable', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const { uid } = req.params;
        const isOnline = await hybridDataService_1.hybridDataService.isFirebaseAvailable();
        if (!isOnline) {
            res.status(503).json({
                success: false,
                error: 'Firebase non disponible'
            });
            return;
        }
        const auth = (0, firebase_1.getAuth)();
        await auth.updateUser(uid, { disabled: false });
        // Aussi débloquer localement
        await userService_1.default.unblockUserByFirebaseUid(uid);
        res.status(200).json({
            success: true,
            message: 'Utilisateur Firebase réactivé'
        });
    }
    catch (error) {
        console.error('Erreur enable Firebase user:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map
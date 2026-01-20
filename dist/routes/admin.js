"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userService_1 = __importDefault(require("../services/userService"));
const loginAttemptService_1 = __importDefault(require("../services/loginAttemptService"));
const sessionService_1 = __importDefault(require("../services/sessionService"));
const hybridDataService_1 = require("../services/hybridDataService");
const auth_1 = require("../middleware/auth");
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
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
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
        // Débloquer l'utilisateur
        await userService_1.default.unblockUser(userId);
        // Réinitialiser les tentatives de connexion
        await loginAttemptService_1.default.resetAttempts(userId);
        res.status(200).json({
            success: true,
            message: `Utilisateur ${user.email} débloqué avec succès`,
            user: {
                id: user.id_user,
                nom: user.nom,
                prenom: user.prenom,
                email: user.email
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
        // Bloquer l'utilisateur
        await userService_1.default.blockUser(userId);
        // Désactiver toutes ses sessions
        await sessionService_1.default.deactivateUserSessions(userId);
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
                nom: user.nom,
                prenom: user.prenom,
                email: user.email,
                date_creation: user.date_creation,
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
 * /api/admin/users/{id}/attempts:
 *   get:
 *     summary: Historique des tentatives de connexion d'un utilisateur
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
 *         description: Historique des tentatives
 */
router.get('/users/:id/attempts', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) {
            res.status(400).json({
                success: false,
                error: 'ID utilisateur invalide'
            });
            return;
        }
        const attempts = await loginAttemptService_1.default.getAttemptHistory(userId, 20);
        res.status(200).json({
            success: true,
            user_id: userId,
            count: attempts.length,
            attempts: attempts.map(attempt => ({
                id: attempt.id_tentative,
                date: attempt.date_tentative,
                succes: attempt.succes,
                adresse_ip: attempt.adresse_ip
            }))
        });
    }
    catch (error) {
        console.error('Erreur historique tentatives:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/admin/users/{id}/reset-attempts:
 *   post:
 *     summary: Réinitialiser les tentatives de connexion d'un utilisateur
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
 *         description: Tentatives réinitialisées
 */
router.post('/users/:id/reset-attempts', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
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
        await loginAttemptService_1.default.resetAttempts(userId);
        res.status(200).json({
            success: true,
            message: `Tentatives de connexion réinitialisées pour ${user.email}`
        });
    }
    catch (error) {
        console.error('Erreur reset tentatives:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/admin/parameters:
 *   get:
 *     summary: Obtenir les paramètres de configuration
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des paramètres
 */
router.get('/parameters', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const parameters = await loginAttemptService_1.default.getAllParameters();
        res.status(200).json({
            success: true,
            parameters: parameters.map(param => ({
                id: param.id_parametre,
                nom: param.nom,
                limite_tentatives: param.limite_tentatives,
                duree_session: param.duree_session,
                duree_session_minutes: Math.round(param.duree_session / 60),
                type_user: param.id_type_user,
                type_libelle: param.type_libelle
            }))
        });
    }
    catch (error) {
        console.error('Erreur get parameters:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/admin/parameters/{typeUserId}:
 *   put:
 *     summary: Modifier les paramètres d'un type d'utilisateur
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: typeUserId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limite_tentatives:
 *                 type: integer
 *                 example: 3
 *               duree_session:
 *                 type: integer
 *                 description: Durée en secondes
 *                 example: 7200
 *     responses:
 *       200:
 *         description: Paramètres mis à jour
 */
router.put('/parameters/:typeUserId', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const typeUserId = parseInt(req.params.typeUserId, 10);
        const { limite_tentatives, duree_session } = req.body;
        if (isNaN(typeUserId)) {
            res.status(400).json({
                success: false,
                error: 'ID type utilisateur invalide'
            });
            return;
        }
        const updated = await loginAttemptService_1.default.updateParameters(typeUserId, limite_tentatives, duree_session);
        if (!updated) {
            res.status(404).json({
                success: false,
                error: 'Paramètres non trouvés pour ce type d\'utilisateur'
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Paramètres mis à jour',
            parameters: {
                id: updated.id_parametre,
                nom: updated.nom,
                limite_tentatives: updated.limite_tentatives,
                duree_session: updated.duree_session,
                duree_session_minutes: Math.round(updated.duree_session / 60)
            }
        });
    }
    catch (error) {
        console.error('Erreur update parameters:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/admin/sessions/stats:
 *   get:
 *     summary: Statistiques des sessions
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistiques des sessions
 */
router.get('/sessions/stats', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const activeSessions = await sessionService_1.default.countActiveSessions();
        res.status(200).json({
            success: true,
            stats: {
                active_sessions: activeSessions
            }
        });
    }
    catch (error) {
        console.error('Erreur stats sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});
/**
 * @swagger
 * /api/admin/sessions/cleanup:
 *   post:
 *     summary: Nettoyer les sessions expirées
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions nettoyées
 */
router.post('/sessions/cleanup', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        const cleaned = await sessionService_1.default.cleanExpiredSessions();
        res.status(200).json({
            success: true,
            message: `${cleaned} session(s) expirée(s) nettoyée(s)`
        });
    }
    catch (error) {
        console.error('Erreur cleanup sessions:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
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
 * /api/admin/sync/execute:
 *   post:
 *     summary: Déclencher la synchronisation vers Firebase
 *     tags: [Administration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Synchronisation effectuée
 */
router.post('/sync/execute', auth_1.authMiddleware, auth_1.managerMiddleware, async (req, res) => {
    try {
        // Vérifier la connexion Firebase
        if (!hybridDataService_1.hybridDataService.isFirebaseAvailable()) {
            res.status(400).json({
                success: false,
                error: 'Firebase non disponible. Vérifiez la connexion internet.'
            });
            return;
        }
        // Déclencher la synchronisation via les endpoints Firebase
        const firebaseResponse = await Promise.all([
            fetch('http://localhost:3000/api/firebase/sync/signalements', {
                method: 'POST',
                headers: {
                    'Authorization': req.headers.authorization || '',
                    'Content-Type': 'application/json'
                }
            }),
            fetch('http://localhost:3000/api/firebase/sync/users', {
                method: 'POST',
                headers: {
                    'Authorization': req.headers.authorization || '',
                    'Content-Type': 'application/json'
                }
            })
        ]);
        const [signalementResult, userResult] = await Promise.all([
            firebaseResponse[0].json(),
            firebaseResponse[1].json()
        ]);
        res.status(200).json({
            success: true,
            message: 'Synchronisation terminée',
            results: {
                signalements: signalementResult,
                users: userResult
            }
        });
    }
    catch (error) {
        console.error('Erreur synchronisation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la synchronisation'
        });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map
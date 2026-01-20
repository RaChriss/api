"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.managerMiddleware = managerMiddleware;
exports.userMiddleware = userMiddleware;
exports.optionalAuthMiddleware = optionalAuthMiddleware;
const sessionService_1 = __importDefault(require("../services/sessionService"));
const userService_1 = __importDefault(require("../services/userService"));
/**
 * Middleware d'authentification - vérifie le token de session
 */
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                error: 'Token d\'authentification requis',
                code: 'MISSING_TOKEN'
            });
            return;
        }
        const token = authHeader.replace('Bearer ', '');
        // Vérifier la session
        const session = await sessionService_1.default.getSessionByToken(token);
        if (!session) {
            res.status(401).json({
                success: false,
                error: 'Session invalide ou expirée',
                code: 'INVALID_SESSION'
            });
            return;
        }
        // Obtenir l'utilisateur
        const user = await userService_1.default.findById(session.id_user);
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'Utilisateur non trouvé',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        // Vérifier si l'utilisateur est bloqué
        if (user.est_bloque) {
            res.status(403).json({
                success: false,
                error: 'Votre compte est bloqué',
                code: 'ACCOUNT_BLOCKED'
            });
            return;
        }
        // Ajouter l'utilisateur et la session à la requête
        req.user = {
            id: user.id_user,
            nom: user.nom,
            prenom: user.prenom || '',
            email: user.email,
            type_user: user.id_type_user,
            est_bloque: user.est_bloque
        };
        req.session = {
            token: session.token,
            expires_at: session.date_expiration
        };
        next();
    }
    catch (error) {
        console.error('Erreur middleware auth:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur d\'authentification',
            code: 'AUTH_ERROR'
        });
    }
}
/**
 * Middleware pour vérifier si l'utilisateur est un Manager (type 3)
 */
async function managerMiddleware(req, res, next) {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Non authentifié',
                code: 'NOT_AUTHENTICATED'
            });
            return;
        }
        // Type 3 = Manager
        if (req.user.type_user !== 3) {
            res.status(403).json({
                success: false,
                error: 'Accès réservé aux managers',
                code: 'MANAGER_ONLY'
            });
            return;
        }
        next();
    }
    catch (error) {
        console.error('Erreur middleware manager:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur de vérification des droits'
        });
    }
}
/**
 * Middleware pour vérifier si l'utilisateur est au moins un Utilisateur (type 2 ou 3)
 */
async function userMiddleware(req, res, next) {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Non authentifié',
                code: 'NOT_AUTHENTICATED'
            });
            return;
        }
        // Type 2 = Utilisateur, Type 3 = Manager
        if (req.user.type_user < 2) {
            res.status(403).json({
                success: false,
                error: 'Accès réservé aux utilisateurs enregistrés',
                code: 'USER_ONLY'
            });
            return;
        }
        next();
    }
    catch (error) {
        console.error('Erreur middleware user:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur de vérification des droits'
        });
    }
}
/**
 * Middleware optionnel - ajoute l'utilisateur si un token est présent mais ne bloque pas
 */
async function optionalAuthMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.replace('Bearer ', '');
            const session = await sessionService_1.default.getSessionByToken(token);
            if (session) {
                const user = await userService_1.default.findById(session.id_user);
                if (user && !user.est_bloque) {
                    req.user = {
                        id: user.id_user,
                        nom: user.nom,
                        prenom: user.prenom || '',
                        email: user.email,
                        type_user: user.id_type_user,
                        est_bloque: user.est_bloque
                    };
                    req.session = {
                        token: session.token,
                        expires_at: session.date_expiration
                    };
                }
            }
        }
        next();
    }
    catch (error) {
        // En cas d'erreur, continuer sans authentification
        console.warn('Erreur middleware optionalAuth:', error.message);
        next();
    }
}
exports.default = {
    authMiddleware,
    managerMiddleware,
    userMiddleware,
    optionalAuthMiddleware
};
//# sourceMappingURL=auth.js.map
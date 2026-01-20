"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionService = void 0;
const database_1 = require("../config/database");
const crypto_1 = __importDefault(require("crypto"));
/**
 * Service de gestion des sessions
 */
class SessionService {
    /**
     * Génère un token de session unique
     */
    static generateToken() {
        return crypto_1.default.randomBytes(64).toString('hex');
    }
    /**
     * Crée une nouvelle session pour un utilisateur
     */
    static async createSession(userId, durationSeconds) {
        const token = this.generateToken();
        // Désactiver les anciennes sessions de l'utilisateur
        await this.deactivateUserSessions(userId);
        const result = await (0, database_1.query)(`INSERT INTO Session (id_user, token, date_creation, date_expiration, est_active)
       VALUES ($1, $2, NOW(), NOW() + INTERVAL '${durationSeconds} seconds', TRUE)
       RETURNING id_session, id_user, token, date_creation, date_expiration, est_active`, [userId, token]);
        return result.rows[0];
    }
    /**
     * Vérifie et récupère une session par son token
     */
    static async getSessionByToken(token) {
        const result = await (0, database_1.query)(`SELECT id_session, id_user, token, date_creation, date_expiration, est_active
       FROM Session
       WHERE token = $1 AND est_active = TRUE AND date_expiration > NOW()`, [token]);
        return result.rows[0] || null;
    }
    /**
     * Vérifie si une session est valide
     */
    static async isSessionValid(token) {
        const session = await this.getSessionByToken(token);
        return session !== null;
    }
    /**
     * Invalide/désactive une session
     */
    static async invalidateSession(token) {
        await (0, database_1.query)(`UPDATE Session SET est_active = FALSE WHERE token = $1`, [token]);
    }
    /**
     * Désactive toutes les sessions d'un utilisateur
     */
    static async deactivateUserSessions(userId) {
        await (0, database_1.query)(`UPDATE Session SET est_active = FALSE WHERE id_user = $1`, [userId]);
    }
    /**
     * Prolonge une session existante
     */
    static async extendSession(token, durationSeconds) {
        const result = await (0, database_1.query)(`UPDATE Session 
       SET date_expiration = NOW() + INTERVAL '${durationSeconds} seconds'
       WHERE token = $1 AND est_active = TRUE
       RETURNING id_session, id_user, token, date_creation, date_expiration, est_active`, [token]);
        return result.rows[0] || null;
    }
    /**
     * Obtient les sessions actives d'un utilisateur
     */
    static async getUserActiveSessions(userId) {
        const result = await (0, database_1.query)(`SELECT id_session, id_user, token, date_creation, date_expiration, est_active
       FROM Session
       WHERE id_user = $1 AND est_active = TRUE AND date_expiration > NOW()
       ORDER BY date_creation DESC`, [userId]);
        return result.rows;
    }
    /**
     * Nettoie les sessions expirées
     */
    static async cleanExpiredSessions() {
        const result = await (0, database_1.query)(`UPDATE Session SET est_active = FALSE 
       WHERE est_active = TRUE AND date_expiration < NOW()`);
        return result.rowCount || 0;
    }
    /**
     * Obtient la durée de session pour un type d'utilisateur
     */
    static async getSessionDuration(typeUserId) {
        const result = await (0, database_1.query)(`SELECT duree_session FROM Parametre WHERE id_type_user = $1`, [typeUserId]);
        return result.rows[0]?.duree_session || 3600; // Par défaut: 1 heure
    }
    /**
     * Compte les sessions actives totales
     */
    static async countActiveSessions() {
        const result = await (0, database_1.query)(`SELECT COUNT(*) as count FROM Session WHERE est_active = TRUE AND date_expiration > NOW()`);
        return parseInt(result.rows[0].count, 10);
    }
}
exports.SessionService = SessionService;
exports.default = SessionService;
//# sourceMappingURL=sessionService.js.map
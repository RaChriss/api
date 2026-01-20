export interface Session {
    id_session: number;
    id_user: number;
    token: string;
    date_creation: Date;
    date_expiration: Date;
    est_active: boolean;
}
/**
 * Service de gestion des sessions
 */
export declare class SessionService {
    /**
     * Génère un token de session unique
     */
    static generateToken(): string;
    /**
     * Crée une nouvelle session pour un utilisateur
     */
    static createSession(userId: number, durationSeconds: number): Promise<Session>;
    /**
     * Vérifie et récupère une session par son token
     */
    static getSessionByToken(token: string): Promise<Session | null>;
    /**
     * Vérifie si une session est valide
     */
    static isSessionValid(token: string): Promise<boolean>;
    /**
     * Invalide/désactive une session
     */
    static invalidateSession(token: string): Promise<void>;
    /**
     * Désactive toutes les sessions d'un utilisateur
     */
    static deactivateUserSessions(userId: number): Promise<void>;
    /**
     * Prolonge une session existante
     */
    static extendSession(token: string, durationSeconds: number): Promise<Session | null>;
    /**
     * Obtient les sessions actives d'un utilisateur
     */
    static getUserActiveSessions(userId: number): Promise<Session[]>;
    /**
     * Nettoie les sessions expirées
     */
    static cleanExpiredSessions(): Promise<number>;
    /**
     * Obtient la durée de session pour un type d'utilisateur
     */
    static getSessionDuration(typeUserId: number): Promise<number>;
    /**
     * Compte les sessions actives totales
     */
    static countActiveSessions(): Promise<number>;
}
export default SessionService;
//# sourceMappingURL=sessionService.d.ts.map
export interface TentativeConnexion {
    id_tentative: number;
    id_user: number;
    date_tentative: Date;
    succes: boolean;
    adresse_ip?: string;
}
export interface Parametre {
    id_parametre: number;
    nom: string;
    limite_tentatives: number;
    duree_session: number;
    id_type_user: number;
}
/**
 * Service de gestion des tentatives de connexion et du blocage
 */
export declare class LoginAttemptService {
    /**
     * Enregistre une tentative de connexion
     */
    static recordAttempt(userId: number, success: boolean, ip?: string): Promise<void>;
    /**
     * Obtient le nombre de tentatives échouées récentes pour un utilisateur
     * (dans les dernières 15 minutes)
     */
    static getRecentFailedAttempts(userId: number): Promise<number>;
    /**
     * Obtient la limite de tentatives pour un type d'utilisateur
     */
    static getAttemptLimit(typeUserId: number): Promise<number>;
    /**
     * Vérifie si un utilisateur doit être bloqué
     * Retourne true si l'utilisateur doit être bloqué
     * Note: Les managers (type 3) ne sont jamais bloqués
     */
    static shouldBlockUser(userId: number, typeUserId: number): Promise<boolean>;
    /**
     * Réinitialise les tentatives de connexion d'un utilisateur
     * (supprime les tentatives échouées)
     */
    static resetAttempts(userId: number): Promise<void>;
    /**
     * Obtient l'historique des tentatives d'un utilisateur
     */
    static getAttemptHistory(userId: number, limit?: number): Promise<TentativeConnexion[]>;
    /**
     * Obtient les paramètres pour un type d'utilisateur
     */
    static getParameters(typeUserId: number): Promise<Parametre | null>;
    /**
     * Met à jour les paramètres d'un type d'utilisateur
     */
    static updateParameters(typeUserId: number, limiteTentatives?: number, dureeSession?: number): Promise<Parametre | null>;
    /**
     * Obtient tous les paramètres
     */
    static getAllParameters(): Promise<Parametre[]>;
}
export default LoginAttemptService;
//# sourceMappingURL=loginAttemptService.d.ts.map
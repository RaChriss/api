/**
 * Utilitaires pour la gestion des types d'utilisateurs
 */
export declare enum UserTypeId {
    VISITEUR = 1,
    UTILISATEUR = 2,
    MANAGER = 3
}
export interface UserType {
    id: number;
    name: string;
    description: string;
    permissions: string[];
}
/**
 * Obtenir le nom du type d'utilisateur à partir de son ID
 * @param typeUserId - L'ID du type d'utilisateur (1, 2, ou 3)
 * @returns Le nom du type d'utilisateur ou 'Inconnu' si l'ID n'existe pas
 */
export declare function getUserTypeName(typeUserId: number): string;
/**
 * Obtenir les informations complètes d'un type d'utilisateur
 * @param typeUserId - L'ID du type d'utilisateur
 * @returns Les informations du type d'utilisateur ou null si l'ID n'existe pas
 */
export declare function getUserTypeById(typeUserId: number): UserType | null;
/**
 * Vérifier si un type d'utilisateur a une permission spécifique
 * @param typeUserId - L'ID du type d'utilisateur
 * @param permission - La permission à vérifier
 * @returns true si l'utilisateur a la permission, false sinon
 */
export declare function hasPermission(typeUserId: number, permission: string): boolean;
/**
 * Obtenir tous les types d'utilisateurs
 * @returns Tableau de tous les types d'utilisateurs
 */
export declare function getAllUserTypes(): UserType[];
/**
 * Vérifier si un ID de type d'utilisateur est valide
 * @param typeUserId - L'ID à vérifier
 * @returns true si l'ID est valide, false sinon
 */
export declare function isValidUserTypeId(typeUserId: number): boolean;
/**
 * Obtenir les permissions d'un type d'utilisateur
 * @param typeUserId - L'ID du type d'utilisateur
 * @returns Tableau des permissions ou tableau vide si l'ID n'existe pas
 */
export declare function getUserPermissions(typeUserId: number): string[];
declare const _default: {
    getUserTypeName: typeof getUserTypeName;
    getUserTypeById: typeof getUserTypeById;
    hasPermission: typeof hasPermission;
    getAllUserTypes: typeof getAllUserTypes;
    isValidUserTypeId: typeof isValidUserTypeId;
    getUserPermissions: typeof getUserPermissions;
    UserTypeId: typeof UserTypeId;
};
export default _default;
//# sourceMappingURL=userTypes.d.ts.map
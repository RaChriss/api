/**
 * Utilitaires pour la gestion des types d'utilisateurs
 */

export enum UserTypeId {
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
 * Définition des types d'utilisateurs avec leurs permissions
 */
const USER_TYPES: Record<number, UserType> = {
  [UserTypeId.VISITEUR]: {
    id: 1,
    name: 'Visiteur',
    description: 'Accès en lecture seule aux signalements publics',
    permissions: ['read_signalements']
  },
  [UserTypeId.UTILISATEUR]: {
    id: 2,
    name: 'Utilisateur',
    description: 'Peut créer et modifier ses propres signalements',
    permissions: ['read_signalements', 'create_signalement', 'update_own_signalement']
  },
  [UserTypeId.MANAGER]: {
    id: 3,
    name: 'Manager',
    description: 'Accès complet avec administration des utilisateurs',
    permissions: [
      'read_signalements', 
      'create_signalement', 
      'update_signalement', 
      'delete_signalement',
      'manage_users', 
      'manage_parameters',
      'view_admin_panel'
    ]
  }
};

/**
 * Obtenir le nom du type d'utilisateur à partir de son ID
 * @param typeUserId - L'ID du type d'utilisateur (1, 2, ou 3)
 * @returns Le nom du type d'utilisateur ou 'Inconnu' si l'ID n'existe pas
 */
export function getUserTypeName(typeUserId: number): string {
  const userType = USER_TYPES[typeUserId];
  return userType ? userType.name : 'Inconnu';
}

/**
 * Obtenir les informations complètes d'un type d'utilisateur
 * @param typeUserId - L'ID du type d'utilisateur
 * @returns Les informations du type d'utilisateur ou null si l'ID n'existe pas
 */
export function getUserTypeById(typeUserId: number): UserType | null {
  return USER_TYPES[typeUserId] || null;
}

/**
 * Vérifier si un type d'utilisateur a une permission spécifique
 * @param typeUserId - L'ID du type d'utilisateur
 * @param permission - La permission à vérifier
 * @returns true si l'utilisateur a la permission, false sinon
 */
export function hasPermission(typeUserId: number, permission: string): boolean {
  const userType = USER_TYPES[typeUserId];
  return userType ? userType.permissions.includes(permission) : false;
}

/**
 * Obtenir tous les types d'utilisateurs
 * @returns Tableau de tous les types d'utilisateurs
 */
export function getAllUserTypes(): UserType[] {
  return Object.values(USER_TYPES);
}

/**
 * Vérifier si un ID de type d'utilisateur est valide
 * @param typeUserId - L'ID à vérifier
 * @returns true si l'ID est valide, false sinon
 */
export function isValidUserTypeId(typeUserId: number): boolean {
  return typeUserId in USER_TYPES;
}

/**
 * Obtenir les permissions d'un type d'utilisateur
 * @param typeUserId - L'ID du type d'utilisateur
 * @returns Tableau des permissions ou tableau vide si l'ID n'existe pas
 */
export function getUserPermissions(typeUserId: number): string[] {
  const userType = USER_TYPES[typeUserId];
  return userType ? userType.permissions : [];
}

export default {
  getUserTypeName,
  getUserTypeById,
  hasPermission,
  getAllUserTypes,
  isValidUserTypeId,
  getUserPermissions,
  UserTypeId
};
export interface User {
    id_user: number;
    nom: string;
    prenom: string;
    email: string;
    password?: string;
    firebase_uid?: string;
    date_creation: Date;
    est_bloque: boolean;
    id_type_user: number;
}
export interface CreateUserDTO {
    nom: string;
    prenom?: string;
    email: string;
    password: string;
    id_type_user?: number;
}
export interface UpdateUserDTO {
    nom?: string;
    prenom?: string;
    email?: string;
    password?: string;
}
/**
 * Service de gestion des utilisateurs
 */
export declare class UserService {
    /**
     * Crée un nouvel utilisateur
     */
    static create(userData: CreateUserDTO): Promise<User>;
    /**
     * Trouve un utilisateur par email
     */
    static findByEmail(email: string): Promise<User | null>;
    /**
     * Trouve un utilisateur par ID
     */
    static findById(id: number): Promise<User | null>;
    /**
     * Trouve un utilisateur par Firebase UID
     */
    static findByFirebaseUid(firebaseUid: string): Promise<User | null>;
    /**
     * Met à jour un utilisateur
     */
    static update(id: number, userData: UpdateUserDTO): Promise<User | null>;
    /**
     * Met à jour le Firebase UID d'un utilisateur
     */
    static updateFirebaseUid(id: number, firebaseUid: string): Promise<void>;
    /**
     * Bloque un utilisateur
     * Note: Les managers (type 3) ne peuvent pas être bloqués
     */
    static blockUser(id: number): Promise<void>;
    /**
     * Débloque un utilisateur
     */
    static unblockUser(id: number): Promise<void>;
    /**
     * Liste tous les utilisateurs bloqués
     */
    static getBlockedUsers(): Promise<User[]>;
    /**
     * Vérifie le mot de passe d'un utilisateur
     */
    static verifyPassword(user: User, password: string): Promise<boolean>;
    /**
     * Liste tous les utilisateurs
     */
    static findAll(): Promise<User[]>;
}
export default UserService;
//# sourceMappingURL=userService.d.ts.map
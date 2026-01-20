import { query } from '../config/database';
import bcrypt from 'bcryptjs';

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
  id_type_user?: number; // Par défaut: 2 (Utilisateur)
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
export class UserService {
  
  /**
   * Crée un nouvel utilisateur
   */
  static async create(userData: CreateUserDTO): Promise<User> {
    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const result = await query(
      `INSERT INTO User_ (nom, prenom, email, password, id_type_user, date_creation, est_bloque)
       VALUES ($1, $2, $3, $4, $5, NOW(), FALSE)
       RETURNING id_user, nom, prenom, email, date_creation, est_bloque, id_type_user`,
      [
        userData.nom,
        userData.prenom || null,
        userData.email,
        hashedPassword,
        userData.id_type_user || 2 // Par défaut: Utilisateur
      ]
    );
    
    return result.rows[0];
  }

  /**
   * Trouve un utilisateur par email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query(
      `SELECT id_user, nom, prenom, email, password, firebase_uid, date_creation, est_bloque, id_type_user
       FROM User_ WHERE email = $1`,
      [email]
    );
    return result.rows[0] || null;
  }

  /**
   * Trouve un utilisateur par ID
   */
  static async findById(id: number): Promise<User | null> {
    const result = await query(
      `SELECT id_user, nom, prenom, email, firebase_uid, date_creation, est_bloque, id_type_user
       FROM User_ WHERE id_user = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Trouve un utilisateur par Firebase UID
   */
  static async findByFirebaseUid(firebaseUid: string): Promise<User | null> {
    const result = await query(
      `SELECT id_user, nom, prenom, email, firebase_uid, date_creation, est_bloque, id_type_user
       FROM User_ WHERE firebase_uid = $1`,
      [firebaseUid]
    );
    return result.rows[0] || null;
  }

  /**
   * Met à jour un utilisateur
   */
  static async update(id: number, userData: UpdateUserDTO): Promise<User | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (userData.nom !== undefined) {
      updates.push(`nom = $${paramIndex++}`);
      values.push(userData.nom);
    }
    if (userData.prenom !== undefined) {
      updates.push(`prenom = $${paramIndex++}`);
      values.push(userData.prenom);
    }
    if (userData.email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(userData.email);
    }
    if (userData.password !== undefined) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      updates.push(`password = $${paramIndex++}`);
      values.push(hashedPassword);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE User_ SET ${updates.join(', ')}
       WHERE id_user = $${paramIndex}
       RETURNING id_user, nom, prenom, email, firebase_uid, date_creation, est_bloque, id_type_user`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Met à jour le Firebase UID d'un utilisateur
   */
  static async updateFirebaseUid(id: number, firebaseUid: string): Promise<void> {
    await query(
      `UPDATE User_ SET firebase_uid = $1 WHERE id_user = $2`,
      [firebaseUid, id]
    );
  }

  /**
   * Bloque un utilisateur
   * Note: Les managers (type 3) ne peuvent pas être bloqués
   */
  static async blockUser(id: number): Promise<void> {
    // Vérifier d'abord le type de l'utilisateur
    const user = await this.findById(id);
    if (!user) {
      throw new Error('Utilisateur introuvable');
    }
    
    // Les managers ne peuvent pas être bloqués
    if (user.id_type_user === 3) {
      throw new Error('Les managers ne peuvent pas être bloqués');
    }
    
    await query(
      `UPDATE User_ SET est_bloque = TRUE WHERE id_user = $1 AND id_type_user != 3`,
      [id]
    );
  }

  /**
   * Débloque un utilisateur
   */
  static async unblockUser(id: number): Promise<void> {
    await query(
      `UPDATE User_ SET est_bloque = FALSE WHERE id_user = $1`,
      [id]
    );
  }

  /**
   * Liste tous les utilisateurs bloqués
   */
  static async getBlockedUsers(): Promise<User[]> {
    const result = await query(
      `SELECT id_user, nom, prenom, email, firebase_uid, date_creation, est_bloque, id_type_user
       FROM User_ WHERE est_bloque = TRUE`
    );
    return result.rows;
  }

  /**
   * Vérifie le mot de passe d'un utilisateur
   */
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password) return false;
    return bcrypt.compare(password, user.password);
  }

  /**
   * Liste tous les utilisateurs
   */
  static async findAll(): Promise<User[]> {
    const result = await query(
      `SELECT u.id_user, u.nom, u.prenom, u.email, u.firebase_uid, u.date_creation, u.est_bloque, u.id_type_user, t.libelle as type_libelle
       FROM User_ u
       JOIN TypeUser t ON u.id_type_user = t.id_type_user
       ORDER BY u.date_creation DESC`
    );
    return result.rows;
  }
}

export default UserService;

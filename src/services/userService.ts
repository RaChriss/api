import { query } from '../config/database';
// Mot de passe en clair pour le développement

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
    // Mot de passe stocké en clair (développement)
    const result = await query(
      `INSERT INTO user_ (nom, prenom, email, password, id_type_user, date_creation, est_bloque)
       VALUES ($1, $2, $3, $4, $5, NOW(), FALSE)
       RETURNING id_user, nom, prenom, email, date_creation, est_bloque, id_type_user`,
      [
        userData.nom,
        userData.prenom || null,
        userData.email,
        userData.password,
        userData.id_type_user || 2 // Par défaut: Utilisateur
      ]
    );
    
    return result.rows[0];
  }

  /**
   * Crée un utilisateur depuis Firebase (mot de passe déjà hashé)
   * Utilisé pour synchroniser les utilisateurs Firebase vers PostgreSQL
   */
  static async createFromFirebase(userData: {
    nom: string;
    prenom?: string;
    email: string;
    password: string; // Déjà hashé depuis Firebase
    id_type_user: number;
    firebase_uid?: string;
  }): Promise<User> {
    // NE PAS re-hasher le mot de passe - il vient de Firebase déjà hashé
    const result = await query(
      `INSERT INTO user_ (nom, prenom, email, password, id_type_user, firebase_uid, date_creation, est_bloque)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), FALSE)
       RETURNING id_user, nom, prenom, email, date_creation, est_bloque, id_type_user, firebase_uid`,
      [
        userData.nom,
        userData.prenom || null,
        userData.email,
        userData.password, // Déjà hashé
        userData.id_type_user,
        userData.firebase_uid || null
      ]
    );
    
    console.log(`✅ Utilisateur créé depuis Firebase: ${userData.email}`);
    return result.rows[0];
  }

  /**
   * Trouve un utilisateur par email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const result = await query(
      `SELECT id_user, nom, prenom, email, password, firebase_uid, date_creation, est_bloque, id_type_user
       FROM user_ WHERE email = $1`,
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
       FROM user_ WHERE id_user = $1`,
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
       FROM user_ WHERE firebase_uid = $1`,
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
      updates.push(`password = $${paramIndex++}`);
      values.push(userData.password);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE user_ SET ${updates.join(', ')}
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
      `UPDATE user_ SET firebase_uid = $1 WHERE id_user = $2`,
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
      `UPDATE user_ SET est_bloque = TRUE WHERE id_user = $1 AND id_type_user != 3`,
      [id]
    );
  }

  /**
   * Débloque un utilisateur
   */
  static async unblockUser(id: number): Promise<void> {
    await query(
      `UPDATE user_ SET est_bloque = FALSE WHERE id_user = $1`,
      [id]
    );
  }

  /**
   * Liste tous les utilisateurs bloqués
   */
  static async getBlockedUsers(): Promise<User[]> {
    const result = await query(
      `SELECT id_user, nom, prenom, email, firebase_uid, date_creation, est_bloque, id_type_user
       FROM user_ WHERE est_bloque = TRUE`
    );
    return result.rows;
  }

  /**
   * Vérifie le mot de passe d'un utilisateur (comparaison en clair)
   */
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.password) return false;
    return user.password === password;
  }

  /**
   * Liste tous les utilisateurs
   */
  static async findAll(): Promise<User[]> {
    const result = await query(
      `SELECT u.id_user, u.nom, u.prenom, u.email, u.firebase_uid, u.date_creation, u.est_bloque, u.id_type_user, t.libelle as type_libelle
       FROM user_ u
       JOIN TypeUser t ON u.id_type_user = t.id_type_user
       ORDER BY u.date_creation DESC`
    );
    return result.rows;
  }
}

export default UserService;

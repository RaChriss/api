"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const database_1 = require("../config/database");
/**
 * Service de gestion des utilisateurs
 */
class UserService {
    /**
     * Crée un nouvel utilisateur
     */
    static async create(userData) {
        // Mot de passe stocké en clair (développement)
        const result = await (0, database_1.query)(`INSERT INTO User_ (nom, prenom, email, password, id_type_user, date_creation, est_bloque)
       VALUES ($1, $2, $3, $4, $5, NOW(), FALSE)
       RETURNING id_user, nom, prenom, email, date_creation, est_bloque, id_type_user`, [
            userData.nom,
            userData.prenom || null,
            userData.email,
            userData.password,
            userData.id_type_user || 2 // Par défaut: Utilisateur
        ]);
        return result.rows[0];
    }
    /**
     * Crée un utilisateur depuis Firebase (mot de passe déjà hashé)
     * Utilisé pour synchroniser les utilisateurs Firebase vers PostgreSQL
     */
    static async createFromFirebase(userData) {
        // NE PAS re-hasher le mot de passe - il vient de Firebase déjà hashé
        const result = await (0, database_1.query)(`INSERT INTO User_ (nom, prenom, email, password, id_type_user, firebase_uid, date_creation, est_bloque)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), FALSE)
       RETURNING id_user, nom, prenom, email, date_creation, est_bloque, id_type_user, firebase_uid`, [
            userData.nom,
            userData.prenom || null,
            userData.email,
            userData.password, // Déjà hashé
            userData.id_type_user,
            userData.firebase_uid || null
        ]);
        console.log(`✅ Utilisateur créé depuis Firebase: ${userData.email}`);
        return result.rows[0];
    }
    /**
     * Trouve un utilisateur par email
     */
    static async findByEmail(email) {
        const result = await (0, database_1.query)(`SELECT id_user, nom, prenom, email, password, firebase_uid, date_creation, est_bloque, id_type_user
       FROM User_ WHERE email = $1`, [email]);
        return result.rows[0] || null;
    }
    /**
     * Trouve un utilisateur par ID
     */
    static async findById(id) {
        const result = await (0, database_1.query)(`SELECT id_user, nom, prenom, email, firebase_uid, date_creation, est_bloque, id_type_user
       FROM User_ WHERE id_user = $1`, [id]);
        return result.rows[0] || null;
    }
    /**
     * Trouve un utilisateur par Firebase UID
     */
    static async findByFirebaseUid(firebaseUid) {
        const result = await (0, database_1.query)(`SELECT id_user, nom, prenom, email, firebase_uid, date_creation, est_bloque, id_type_user
       FROM User_ WHERE firebase_uid = $1`, [firebaseUid]);
        return result.rows[0] || null;
    }
    /**
     * Met à jour un utilisateur
     */
    static async update(id, userData) {
        const updates = [];
        const values = [];
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
        const result = await (0, database_1.query)(`UPDATE User_ SET ${updates.join(', ')}
       WHERE id_user = $${paramIndex}
       RETURNING id_user, nom, prenom, email, firebase_uid, date_creation, est_bloque, id_type_user`, values);
        return result.rows[0] || null;
    }
    /**
     * Met à jour le Firebase UID d'un utilisateur
     */
    static async updateFirebaseUid(id, firebaseUid) {
        await (0, database_1.query)(`UPDATE User_ SET firebase_uid = $1 WHERE id_user = $2`, [firebaseUid, id]);
    }
    /**
     * Bloque un utilisateur
     * Note: Les managers (type 3) ne peuvent pas être bloqués
     */
    static async blockUser(id) {
        // Vérifier d'abord le type de l'utilisateur
        const user = await this.findById(id);
        if (!user) {
            throw new Error('Utilisateur introuvable');
        }
        // Les managers ne peuvent pas être bloqués
        if (user.id_type_user === 3) {
            throw new Error('Les managers ne peuvent pas être bloqués');
        }
        await (0, database_1.query)(`UPDATE User_ SET est_bloque = TRUE WHERE id_user = $1 AND id_type_user != 3`, [id]);
    }
    /**
     * Débloque un utilisateur
     */
    static async unblockUser(id) {
        await (0, database_1.query)(`UPDATE User_ SET est_bloque = FALSE WHERE id_user = $1`, [id]);
    }
    /**
     * Liste tous les utilisateurs bloqués
     */
    static async getBlockedUsers() {
        const result = await (0, database_1.query)(`SELECT id_user, nom, prenom, email, firebase_uid, date_creation, est_bloque, id_type_user
       FROM User_ WHERE est_bloque = TRUE`);
        return result.rows;
    }
    /**
     * Vérifie le mot de passe d'un utilisateur (comparaison en clair)
     */
    static async verifyPassword(user, password) {
        if (!user.password)
            return false;
        return user.password === password;
    }
    /**
     * Liste tous les utilisateurs
     */
    static async findAll() {
        const result = await (0, database_1.query)(`SELECT u.id_user, u.nom, u.prenom, u.email, u.firebase_uid, u.date_creation, u.est_bloque, u.id_type_user, t.libelle as type_libelle
       FROM User_ u
       JOIN TypeUser t ON u.id_type_user = t.id_type_user
       ORDER BY u.date_creation DESC`);
        return result.rows;
    }
}
exports.UserService = UserService;
exports.default = UserService;
//# sourceMappingURL=userService.js.map
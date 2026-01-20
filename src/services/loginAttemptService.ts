import { query } from '../config/database';

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
export class LoginAttemptService {
  
  /**
   * Enregistre une tentative de connexion
   */
  static async recordAttempt(userId: number, success: boolean, ip?: string): Promise<void> {
    await query(
      `INSERT INTO tentativeconnexion (id_user, date_tentative, succes, adresse_ip)
       VALUES ($1, NOW(), $2, $3)`,
      [userId, success, ip || null]
    );
  }

  /**
   * Obtient le nombre de tentatives échouées récentes pour un utilisateur
   * (dans les dernières 15 minutes)
   */
  static async getRecentFailedAttempts(userId: number): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM tentativeconnexion 
       WHERE id_user = $1 
       AND succes = FALSE 
       AND date_tentative > NOW() - INTERVAL '15 minutes'`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Obtient la limite de tentatives pour un type d'utilisateur
   */
  static async getAttemptLimit(typeUserId: number): Promise<number> {
    const result = await query(
      `SELECT limite_tentatives FROM parametre WHERE id_type_user = $1`,
      [typeUserId]
    );
    return result.rows[0]?.limite_tentatives || 3; // Par défaut: 3
  }

  /**
   * Vérifie si un utilisateur doit être bloqué
   * Retourne true si l'utilisateur doit être bloqué
   * Note: Les managers (type 3) ne sont jamais bloqués
   */
  static async shouldBlockUser(userId: number, typeUserId: number): Promise<boolean> {
    // Les managers (type 3) ne peuvent jamais être bloqués
    if (typeUserId === 3) {
      return false;
    }
    
    const failedAttempts = await this.getRecentFailedAttempts(userId);
    const limit = await this.getAttemptLimit(typeUserId);
    return failedAttempts >= limit;
  }

  /**
   * Réinitialise les tentatives de connexion d'un utilisateur
   * (supprime les tentatives échouées)
   */
  static async resetAttempts(userId: number): Promise<void> {
    await query(
      `DELETE FROM tentativeconnexion WHERE id_user = $1 AND succes = FALSE`,
      [userId]
    );
  }

  /**
   * Obtient l'historique des tentatives d'un utilisateur
   */
  static async getAttemptHistory(userId: number, limit: number = 10): Promise<TentativeConnexion[]> {
    const result = await query(
      `SELECT id_tentative, id_user, date_tentative, succes, adresse_ip
       FROM tentativeconnexion
       WHERE id_user = $1
       ORDER BY date_tentative DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  }

  /**
   * Obtient les paramètres pour un type d'utilisateur
   */
  static async getParameters(typeUserId: number): Promise<Parametre | null> {
    const result = await query(
      `SELECT id_parametre, nom, limite_tentatives, duree_session, id_type_user
       FROM parametre WHERE id_type_user = $1`,
      [typeUserId]
    );
    return result.rows[0] || null;
  }

  /**
   * Met à jour les paramètres d'un type d'utilisateur
   */
  static async updateParameters(
    typeUserId: number, 
    limiteTentatives?: number, 
    dureeSession?: number
  ): Promise<Parametre | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (limiteTentatives !== undefined) {
      updates.push(`limite_tentatives = $${paramIndex++}`);
      values.push(limiteTentatives);
    }
    if (dureeSession !== undefined) {
      updates.push(`duree_session = $${paramIndex++}`);
      values.push(dureeSession);
    }

    if (updates.length === 0) {
      return this.getParameters(typeUserId);
    }

    values.push(typeUserId);
    const result = await query(
      `UPDATE parametre SET ${updates.join(', ')}
       WHERE id_type_user = $${paramIndex}
       RETURNING id_parametre, nom, limite_tentatives, duree_session, id_type_user`,
      values
    );

    return result.rows[0] || null;
  }

  /**
   * Obtient tous les paramètres
   */
  static async getAllParameters(): Promise<Parametre[]> {
    const result = await query(
      `SELECT p.id_parametre, p.nom, p.limite_tentatives, p.duree_session, p.id_type_user, t.libelle as type_libelle
       FROM parametre p
       JOIN typeuser t ON p.id_type_user = t.id_type_user
       ORDER BY p.id_type_user`
    );
    return result.rows;
  }
}

export default LoginAttemptService;

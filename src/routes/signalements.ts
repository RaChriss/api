import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authMiddleware, managerMiddleware, userMiddleware } from '../middleware/auth';

const router = Router();

// ============================================
// ROUTES PUBLIQUES (Visiteurs)
// ============================================

/**
 * @swagger
 * /api/signalements:
 *   get:
 *     summary: Liste de tous les signalements avec leurs détails
 *     tags: [Signalements - Visiteur]
 *     responses:
 *       200:
 *         description: Liste des signalements pour affichage sur carte
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = `
      SELECT 
        s.id_signalement,
        s.description,
        s.latitude,
        s.longitude,
        s.photo_url,
        s.date_signalement,
        st.libelle as status,
        st.couleur as status_couleur,
        r.surface_m2,
        r.budget,
        r.date_debut,
        r.date_fin_prevue,
        r.date_fin_reelle,
        e.nom as entreprise_nom,
        e.telephone as entreprise_tel
      FROM Signalement s
      JOIN Status st ON s.id_status = st.id_status
      LEFT JOIN Reparation r ON s.id_signalement = r.id_signalement
      LEFT JOIN Entreprise e ON r.id_entreprise = e.id_entreprise
      ORDER BY s.date_signalement DESC
    `;
    
    const result = await pool.query(query);
    
    res.status(200).json({
      success: true,
      count: result.rows.length,
      signalements: result.rows.map(row => ({
        id: row.id_signalement,
        description: row.description,
        location: {
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude)
        },
        photo_url: row.photo_url,
        date_signalement: row.date_signalement,
        status: row.status,
        status_couleur: row.status_couleur,
        // Infos réparation (pour le survol)
        reparation: row.surface_m2 ? {
          surface_m2: parseFloat(row.surface_m2),
          budget: parseFloat(row.budget),
          date_debut: row.date_debut,
          date_fin_prevue: row.date_fin_prevue,
          date_fin_reelle: row.date_fin_reelle,
          entreprise: {
            nom: row.entreprise_nom,
            telephone: row.entreprise_tel
          }
        } : null
      }))
    });
  } catch (error: any) {
    console.error('Erreur récupération signalements:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @swagger
 * /api/signalements/{id}:
 *   get:
 *     summary: Détails complets d'un signalement (pour survol/popup)
 *     tags: [Signalements - Visiteur]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'ID invalide' });
      return;
    }

    const query = `
      SELECT 
        s.id_signalement,
        s.description,
        s.latitude,
        s.longitude,
        s.photo_url,
        s.date_signalement,
        st.id_status,
        st.libelle as status,
        st.couleur as status_couleur,
        r.id_reparation,
        r.surface_m2,
        r.budget,
        r.date_debut,
        r.date_fin_prevue,
        r.date_fin_reelle,
        r.commentaire as reparation_commentaire,
        e.id_entreprise,
        e.nom as entreprise_nom,
        e.telephone as entreprise_tel,
        e.email as entreprise_email,
        e.adresse as entreprise_adresse,
        u.nom as signale_par_nom,
        u.prenom as signale_par_prenom
      FROM Signalement s
      JOIN Status st ON s.id_status = st.id_status
      JOIN User_ u ON s.id_user = u.id_user
      LEFT JOIN Reparation r ON s.id_signalement = r.id_signalement
      LEFT JOIN Entreprise e ON r.id_entreprise = e.id_entreprise
      WHERE s.id_signalement = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Signalement non trouvé' });
      return;
    }

    const row = result.rows[0];
    
    res.status(200).json({
      success: true,
      signalement: {
        id: row.id_signalement,
        description: row.description,
        location: {
          latitude: parseFloat(row.latitude),
          longitude: parseFloat(row.longitude)
        },
        photo_url: row.photo_url,
        date_signalement: row.date_signalement,
        signale_par: `${row.signale_par_prenom} ${row.signale_par_nom}`,
        status: {
          id: row.id_status,
          libelle: row.status,
          couleur: row.status_couleur
        },
        reparation: row.id_reparation ? {
          id: row.id_reparation,
          surface_m2: parseFloat(row.surface_m2),
          budget: parseFloat(row.budget),
          date_debut: row.date_debut,
          date_fin_prevue: row.date_fin_prevue,
          date_fin_reelle: row.date_fin_reelle,
          commentaire: row.reparation_commentaire,
          entreprise: {
            id: row.id_entreprise,
            nom: row.entreprise_nom,
            telephone: row.entreprise_tel,
            email: row.entreprise_email,
            adresse: row.entreprise_adresse
          }
        } : null
      }
    });
  } catch (error: any) {
    console.error('Erreur récupération signalement:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/signalements/recapitulatif:
 *   get:
 *     summary: Tableau récapitulatif pour les visiteurs
 *     tags: [Signalements - Visiteur]
 *     description: Nb de points, total surface, avancement %, total budget
 */
router.get('/stats/recapitulatif', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = `
      SELECT 
        -- Nombre total de signalements
        (SELECT COUNT(*) FROM Signalement) as nb_signalements,
        
        -- Nombre par statut
        (SELECT COUNT(*) FROM Signalement s 
         JOIN Status st ON s.id_status = st.id_status 
         WHERE st.libelle = 'Nouveau') as nb_nouveau,
        
        (SELECT COUNT(*) FROM Signalement s 
         JOIN Status st ON s.id_status = st.id_status 
         WHERE st.libelle ILIKE '%cours%') as nb_en_cours,
        
        (SELECT COUNT(*) FROM Signalement s 
         JOIN Status st ON s.id_status = st.id_status 
         WHERE st.libelle ILIKE '%termin%') as nb_termine,
        
        -- Surface totale en m²
        (SELECT COALESCE(SUM(surface_m2), 0) FROM Reparation) as surface_totale_m2,
        
        -- Budget total
        (SELECT COALESCE(SUM(budget), 0) FROM Reparation) as budget_total,
        
        -- Avancement en % (terminés / total avec réparation)
        (SELECT 
          CASE 
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND((COUNT(CASE WHEN date_fin_reelle IS NOT NULL THEN 1 END)::DECIMAL / COUNT(*)) * 100, 2)
          END
         FROM Reparation) as avancement_pct,
        
        -- Nombre d'entreprises impliquées
        (SELECT COUNT(DISTINCT id_entreprise) FROM Reparation) as nb_entreprises
    `;
    
    const result = await pool.query(query);
    const stats = result.rows[0];
    
    res.status(200).json({
      success: true,
      recapitulatif: {
        signalements: {
          total: parseInt(stats.nb_signalements),
          nouveau: parseInt(stats.nb_nouveau),
          en_cours: parseInt(stats.nb_en_cours),
          termine: parseInt(stats.nb_termine)
        },
        surface_totale_m2: parseFloat(stats.surface_totale_m2),
        budget_total: parseFloat(stats.budget_total),
        avancement_pct: parseFloat(stats.avancement_pct),
        nb_entreprises: parseInt(stats.nb_entreprises)
      }
    });
  } catch (error: any) {
    console.error('Erreur récupération récapitulatif:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ============================================
// ROUTES UTILISATEUR CONNECTÉ
// ============================================

/**
 * @swagger
 * /api/signalements:
 *   post:
 *     summary: Créer un nouveau signalement
 *     tags: [Signalements - Utilisateur]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { description, latitude, longitude, photo_url } = req.body;
    const userId = req.user?.id;

    if (!latitude || !longitude) {
      res.status(400).json({ 
        success: false, 
        error: 'Latitude et longitude sont requis' 
      });
      return;
    }

    // Statut par défaut = Nouveau (id = 1)
    const query = `
      INSERT INTO Signalement (description, latitude, longitude, photo_url, id_user, id_status, est_synchronise)
      VALUES ($1, $2, $3, $4, $5, 1, FALSE)
      RETURNING id_signalement, date_signalement
    `;
    
    const result = await pool.query(query, [
      description || null,
      latitude,
      longitude,
      photo_url || null,
      userId
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Signalement créé avec succès',
      signalement: {
        id: result.rows[0].id_signalement,
        date_signalement: result.rows[0].date_signalement
      }
    });
  } catch (error: any) {
    console.error('Erreur création signalement:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ============================================
// ROUTES MANAGER
// ============================================

/**
 * @swagger
 * /api/signalements/manager/list:
 *   get:
 *     summary: Liste des signalements pour gestion (Manager)
 *     tags: [Signalements - Manager]
 *     security:
 *       - bearerAuth: []
 */
router.get('/manager/list', authMiddleware, managerMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, entreprise, date_debut, date_fin } = req.query;
    
    let query = `
      SELECT 
        s.id_signalement,
        s.description,
        s.latitude,
        s.longitude,
        s.date_signalement,
        s.firebase_id,
        s.est_synchronise,
        st.id_status,
        st.libelle as status,
        st.couleur as status_couleur,
        r.id_reparation,
        r.surface_m2,
        r.budget,
        r.date_debut,
        r.date_fin_prevue,
        r.date_fin_reelle,
        e.id_entreprise,
        e.nom as entreprise_nom,
        u.nom as user_nom,
        u.prenom as user_prenom,
        u.email as user_email
      FROM Signalement s
      JOIN Status st ON s.id_status = st.id_status
      JOIN User_ u ON s.id_user = u.id_user
      LEFT JOIN Reparation r ON s.id_signalement = r.id_signalement
      LEFT JOIN Entreprise e ON r.id_entreprise = e.id_entreprise
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND st.id_status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (entreprise) {
      query += ` AND e.id_entreprise = $${paramIndex}`;
      params.push(entreprise);
      paramIndex++;
    }
    
    if (date_debut) {
      query += ` AND s.date_signalement >= $${paramIndex}`;
      params.push(date_debut);
      paramIndex++;
    }
    
    if (date_fin) {
      query += ` AND s.date_signalement <= $${paramIndex}`;
      params.push(date_fin);
      paramIndex++;
    }
    
    query += ' ORDER BY s.date_signalement DESC';
    
    const result = await pool.query(query, params);
    
    res.status(200).json({
      success: true,
      count: result.rows.length,
      signalements: result.rows
    });
  } catch (error: any) {
    console.error('Erreur liste signalements manager:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/signalements/{id}/reparation:
 *   post:
 *     summary: Créer/Modifier les infos de réparation (surface, budget, entreprise)
 *     tags: [Signalements - Manager]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reparation', authMiddleware, managerMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const signalementId = parseInt(req.params.id, 10);
    const { surface_m2, budget, id_entreprise, date_debut, date_fin_prevue, commentaire } = req.body;
    const managerId = req.user?.id;

    if (isNaN(signalementId)) {
      res.status(400).json({ success: false, error: 'ID signalement invalide' });
      return;
    }

    // Vérifier que le signalement existe
    const checkSignalement = await pool.query(
      'SELECT id_signalement FROM Signalement WHERE id_signalement = $1',
      [signalementId]
    );
    
    if (checkSignalement.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Signalement non trouvé' });
      return;
    }

    // Vérifier si une réparation existe déjà
    const existingReparation = await pool.query(
      'SELECT id_reparation FROM Reparation WHERE id_signalement = $1',
      [signalementId]
    );

    let result;
    
    if (existingReparation.rows.length > 0) {
      // Mise à jour
      result = await pool.query(`
        UPDATE Reparation 
        SET surface_m2 = COALESCE($1, surface_m2),
            budget = COALESCE($2, budget),
            id_entreprise = COALESCE($3, id_entreprise),
            date_debut = COALESCE($4, date_debut),
            date_fin_prevue = COALESCE($5, date_fin_prevue),
            commentaire = COALESCE($6, commentaire),
            date_modification = CURRENT_TIMESTAMP
        WHERE id_signalement = $7
        RETURNING *
      `, [surface_m2, budget, id_entreprise, date_debut, date_fin_prevue, commentaire, signalementId]);
      
      res.status(200).json({
        success: true,
        message: 'Réparation mise à jour',
        reparation: result.rows[0]
      });
    } else {
      // Création - statut "En cours" par défaut (id = 2)
      result = await pool.query(`
        INSERT INTO Reparation 
        (surface_m2, budget, id_entreprise, date_debut, date_fin_prevue, commentaire, id_signalement, id_status, id_user)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 2, $8)
        RETURNING *
      `, [surface_m2 || 0, budget || 0, id_entreprise, date_debut, date_fin_prevue, commentaire, signalementId, managerId]);
      
      // Mettre à jour le statut du signalement à "En cours"
      await pool.query(
        'UPDATE Signalement SET id_status = 2 WHERE id_signalement = $1',
        [signalementId]
      );
      
      res.status(201).json({
        success: true,
        message: 'Réparation créée',
        reparation: result.rows[0]
      });
    }
  } catch (error: any) {
    console.error('Erreur gestion réparation:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/signalements/{id}/status:
 *   put:
 *     summary: Modifier le statut d'un signalement
 *     tags: [Signalements - Manager]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/status', authMiddleware, managerMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const signalementId = parseInt(req.params.id, 10);
    const { id_status, commentaire } = req.body;
    const managerId = req.user?.id;

    if (isNaN(signalementId) || !id_status) {
      res.status(400).json({ success: false, error: 'ID signalement et statut requis' });
      return;
    }

    // Récupérer l'ancien statut
    const oldStatusResult = await pool.query(
      'SELECT id_status FROM Signalement WHERE id_signalement = $1',
      [signalementId]
    );
    
    if (oldStatusResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Signalement non trouvé' });
      return;
    }
    
    const oldStatus = oldStatusResult.rows[0].id_status;

    // Mettre à jour le statut du signalement
    await pool.query(
      'UPDATE Signalement SET id_status = $1 WHERE id_signalement = $2',
      [id_status, signalementId]
    );

    // Mettre à jour le statut de la réparation si elle existe
    const reparationResult = await pool.query(
      'SELECT id_reparation FROM Reparation WHERE id_signalement = $1',
      [signalementId]
    );
    
    if (reparationResult.rows.length > 0) {
      const reparationId = reparationResult.rows[0].id_reparation;
      
      // Mettre à jour le statut de la réparation
      await pool.query(
        'UPDATE Reparation SET id_status = $1, date_modification = CURRENT_TIMESTAMP WHERE id_reparation = $2',
        [id_status, reparationId]
      );

      // Enregistrer dans l'historique
      await pool.query(`
        INSERT INTO HistoriqueStatus 
        (id_reparation, id_status_ancien, id_status_nouveau, id_user, commentaire)
        VALUES ($1, $2, $3, $4, $5)
      `, [reparationId, oldStatus, id_status, managerId, commentaire || null]);

      // Si terminé, mettre la date de fin réelle
      const statusResult = await pool.query(
        'SELECT libelle FROM Status WHERE id_status = $1',
        [id_status]
      );
      
      if (statusResult.rows[0]?.libelle?.toLowerCase().includes('termin')) {
        await pool.query(
          'UPDATE Reparation SET date_fin_reelle = CURRENT_DATE WHERE id_reparation = $1',
          [reparationId]
        );
      }
    }

    res.status(200).json({
      success: true,
      message: 'Statut mis à jour',
      old_status: oldStatus,
      new_status: id_status
    });
  } catch (error: any) {
    console.error('Erreur modification statut:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/signalements/statuts:
 *   get:
 *     summary: Liste des statuts disponibles
 *     tags: [Signalements]
 */
router.get('/config/statuts', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM Status ORDER BY id_status');
    
    res.status(200).json({
      success: true,
      statuts: result.rows
    });
  } catch (error: any) {
    console.error('Erreur récupération statuts:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * @swagger
 * /api/signalements/entreprises:
 *   get:
 *     summary: Liste des entreprises disponibles
 *     tags: [Signalements]
 */
router.get('/config/entreprises', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM Entreprise ORDER BY nom');
    
    res.status(200).json({
      success: true,
      entreprises: result.rows
    });
  } catch (error: any) {
    console.error('Erreur récupération entreprises:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;

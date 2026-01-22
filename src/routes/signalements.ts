import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import SignalementService from '../services/signalementService';
import { authMiddleware, managerMiddleware } from '../middleware/auth';
import pool from '../config/database';

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
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *         description: Filtrer par ID de statut
 *       - in: query
 *         name: date_debut
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de début pour le filtre
 *       - in: query
 *         name: date_fin
 *         schema:
 *           type: string
 *           format: date
 *         description: Date de fin pour le filtre
 *     responses:
 *       200:
 *         description: Liste des signalements pour affichage sur carte
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { status, date_debut, date_fin } = req.query;

        const signalements = await SignalementService.findAll({
            status: status ? parseInt(status as string, 10) : undefined,
            dateDebut: date_debut as string,
            dateFin: date_fin as string
        });

        res.status(200).json({
            success: true,
            count: signalements.length,
            signalements: signalements.map(s => ({
                id: s.id_signalement,
                description: s.description,
                location: s.location,
                date_signalement: s.date_signalement,
                status: {
                    libelle: s.status_libelle,
                    couleur: s.status_couleur
                },
                signale_par: s.user_display_name || s.user_email,
                reparation: s.reparation ? {
                    surface_m2: s.reparation.surface_m2,
                    budget: s.reparation.budget,
                    date_debut: s.reparation.date_debut,
                    date_fin_prevue: s.reparation.date_fin_prevue,
                    date_fin_reelle: s.reparation.date_fin_reelle,
                    entreprise: {
                        nom: s.reparation.entreprise_nom,
                        telephone: s.reparation.entreprise_tel
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
 * /api/signalements/stats/recapitulatif:
 *   get:
 *     summary: Tableau récapitulatif pour les visiteurs
 *     tags: [Signalements - Visiteur]
 *     description: Statistiques globales - nb de signalements, surface, budget, avancement
 *     responses:
 *       200:
 *         description: Statistiques récapitulatives
 */
router.get('/stats/recapitulatif', async (req: Request, res: Response): Promise<void> => {
    try {
        const stats = await SignalementService.getStats();

        res.status(200).json({
            success: true,
            recapitulatif: {
                signalements: {
                    total: stats.total,
                    par_status: stats.par_status
                },
                surface_totale_m2: stats.surface_totale,
                budget_total: stats.budget_total,
                avancement_pct: stats.avancement_pct
            }
        });
    } catch (error: any) {
        console.error('Erreur récupération récapitulatif:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/**
 * @swagger
 * /api/signalements/config/statuts:
 *   get:
 *     summary: Liste des statuts disponibles
 *     tags: [Signalements - Configuration]
 *     responses:
 *       200:
 *         description: Liste des statuts
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
 * /api/signalements/config/entreprises:
 *   get:
 *     summary: Liste des entreprises disponibles
 *     tags: [Signalements - Configuration]
 *     responses:
 *       200:
 *         description: Liste des entreprises
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

/**
 * @swagger
 * /api/signalements/user/mes-signalements:
 *   get:
 *     summary: Liste des signalements de l'utilisateur connecté
 *     tags: [Signalements - Utilisateur]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des signalements de l'utilisateur
 *       401:
 *         description: Non authentifié
 */
router.get('/user/mes-signalements', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                success: false,
                error: 'Utilisateur non identifié'
            });
            return;
        }

        const signalements = await SignalementService.findByUserId(userId);

        res.status(200).json({
            success: true,
            count: signalements.length,
            signalements: signalements.map(s => ({
                id: s.id_signalement,
                description: s.description,
                location: s.location,
                date_signalement: s.date_signalement,
                firebase_id: s.firebase_id,
                est_synchronise: s.est_synchronise,
                status: {
                    id: s.id_status,
                    libelle: s.status_libelle,
                    couleur: s.status_couleur
                },
                reparation: s.reparation
            }))
        });
    } catch (error: any) {
        console.error('Erreur récupération mes signalements:', error);
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
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *       - in: query
 *         name: date_debut
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: date_fin
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Liste des signalements avec détails de gestion
 */
router.get('/manager/list', authMiddleware, managerMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const { status, date_debut, date_fin } = req.query;

        const signalements = await SignalementService.findAll({
            status: status ? parseInt(status as string, 10) : undefined,
            dateDebut: date_debut as string,
            dateFin: date_fin as string
        });

        res.status(200).json({
            success: true,
            count: signalements.length,
            signalements
        });
    } catch (error: any) {
        console.error('Erreur liste signalements manager:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/**
 * @swagger
 * /api/signalements/manager/pending-sync:
 *   get:
 *     summary: Liste des signalements non synchronisés avec Firebase
 *     tags: [Signalements - Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des signalements en attente de synchronisation
 */
router.get('/manager/pending-sync', authMiddleware, managerMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const pending = await SignalementService.getPendingSync();

        res.status(200).json({
            success: true,
            count: pending.length,
            signalements: pending
        });
    } catch (error: any) {
        console.error('Erreur récupération signalements non synchronisés:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/**
 * @swagger
 * /api/signalements/manager/sync:
 *   post:
 *     summary: Synchroniser les signalements en attente avec Firebase
 *     tags: [Signalements - Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Résultat de la synchronisation
 */
router.post('/manager/sync', authMiddleware, managerMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await SignalementService.syncPendingToFirebase();

        res.status(200).json({
            success: true,
            message: `Synchronisation terminée: ${result.synced} succès, ${result.errors} erreurs`,
            result
        });
    } catch (error: any) {
        console.error('Erreur synchronisation:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

/**
 * @swagger
 * /api/signalements/{id}:
 *   get:
 *     summary: Détails complets d'un signalement
 *     tags: [Signalements - Visiteur]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du signalement
 *     responses:
 *       200:
 *         description: Détails du signalement
 *       404:
 *         description: Signalement non trouvé
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id)) {
            res.status(400).json({ success: false, error: 'ID invalide' });
            return;
        }

        const signalement = await SignalementService.findById(id);

        if (!signalement) {
            res.status(404).json({ success: false, error: 'Signalement non trouvé' });
            return;
        }

        res.status(200).json({
            success: true,
            signalement: {
                id: signalement.id_signalement,
                description: signalement.description,
                location: signalement.location,
                date_signalement: signalement.date_signalement,
                firebase_id: signalement.firebase_id,
                est_synchronise: signalement.est_synchronise,
                signale_par: {
                    display_name: signalement.user_display_name,
                    email: signalement.user_email
                },
                status: {
                    id: signalement.id_status,
                    libelle: signalement.status_libelle,
                    couleur: signalement.status_couleur
                },
                reparation: signalement.reparation
            }
        });
    } catch (error: any) {
        console.error('Erreur récupération signalement:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ============================================
// ROUTES UTILISATEUR CONNECTÉ (CRUD)
// ============================================

/**
 * @swagger
 * /api/signalements:
 *   post:
 *     summary: Créer un nouveau signalement
 *     tags: [Signalements - Utilisateur]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *                 example: -18.8792
 *               longitude:
 *                 type: number
 *                 example: 47.5079
 *               description:
 *                 type: string
 *                 example: "Nid de poule dangereux sur la route principale"
 *     responses:
 *       201:
 *         description: Signalement créé avec succès
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 */
router.post('/',
    authMiddleware,
    [
        body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide (doit être entre -90 et 90)'),
        body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide (doit être entre -180 et 180)'),
        body('description').optional().isString().isLength({ max: 500 }).withMessage('Description trop longue (max 500 caractères)')
    ],
    async (req: Request, res: Response): Promise<void> => {
        try {
            // Validation des entrées
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
                return;
            }

            const { description, latitude, longitude } = req.body;
            const firebaseUid = req.user?.firebase_uid;

            if (!firebaseUid) {
                res.status(401).json({
                    success: false,
                    error: 'Utilisateur Firebase non identifié'
                });
                return;
            }

            const signalement = await SignalementService.create({
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                description,
                firebase_uid: firebaseUid
            });

            res.status(201).json({
                success: true,
                message: 'Signalement créé avec succès',
                signalement: {
                    id: signalement.id_signalement,
                    location: signalement.location,
                    description: signalement.description,
                    date_signalement: signalement.date_signalement,
                    firebase_id: signalement.firebase_id,
                    est_synchronise: signalement.est_synchronise
                }
            });
        } catch (error: any) {
            console.error('Erreur création signalement:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }
);

/**
 * @swagger
 * /api/signalements/{id}:
 *   put:
 *     summary: Modifier un signalement (uniquement si statut "Nouveau")
 *     tags: [Signalements - Utilisateur]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signalement mis à jour
 *       400:
 *         description: Données invalides
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Non autorisé
 *       404:
 *         description: Signalement non trouvé
 *       409:
 *         description: Signalement verrouillé (en cours de traitement)
 */
router.put('/:id',
    authMiddleware,
    [
        param('id').isInt({ min: 1 }).withMessage('ID invalide'),
        body('latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude invalide'),
        body('longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude invalide'),
        body('description').optional().isString().isLength({ max: 500 }).withMessage('Description trop longue')
    ],
    async (req: Request, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
                return;
            }

            const id = parseInt(req.params.id, 10);
            const userId = req.user?.id;
            const { description, latitude, longitude } = req.body;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Utilisateur non identifié'
                });
                return;
            }

            const signalement = await SignalementService.update(id, userId, {
                description,
                latitude: latitude ? parseFloat(latitude) : undefined,
                longitude: longitude ? parseFloat(longitude) : undefined
            });

            if (!signalement) {
                res.status(404).json({ success: false, error: 'Signalement non trouvé' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Signalement mis à jour',
                signalement
            });
        } catch (error: any) {
            console.error('Erreur modification signalement:', error);

            if (error.message.startsWith('UNAUTHORIZED')) {
                res.status(403).json({ success: false, error: error.message.replace('UNAUTHORIZED: ', '') });
                return;
            }

            if (error.message.startsWith('LOCKED')) {
                res.status(409).json({ success: false, error: error.message.replace('LOCKED: ', '') });
                return;
            }

            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }
);

/**
 * @swagger
 * /api/signalements/{id}:
 *   delete:
 *     summary: Supprimer un signalement (uniquement si statut "Nouveau")
 *     tags: [Signalements - Utilisateur]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Signalement supprimé
 *       401:
 *         description: Non authentifié
 *       403:
 *         description: Non autorisé
 *       404:
 *         description: Signalement non trouvé
 *       409:
 *         description: Signalement verrouillé (en cours de traitement)
 */
router.delete('/:id',
    authMiddleware,
    [param('id').isInt({ min: 1 }).withMessage('ID invalide')],
    async (req: Request, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
                return;
            }

            const id = parseInt(req.params.id, 10);
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    error: 'Utilisateur non identifié'
                });
                return;
            }

            const deleted = await SignalementService.delete(id, userId);

            if (!deleted) {
                res.status(404).json({ success: false, error: 'Signalement non trouvé' });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Signalement supprimé avec succès'
            });
        } catch (error: any) {
            console.error('Erreur suppression signalement:', error);

            if (error.message.startsWith('UNAUTHORIZED')) {
                res.status(403).json({ success: false, error: error.message.replace('UNAUTHORIZED: ', '') });
                return;
            }

            if (error.message.startsWith('LOCKED')) {
                res.status(409).json({ success: false, error: error.message.replace('LOCKED: ', '') });
                return;
            }

            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }
);

// ============================================
// ROUTES MANAGER - RÉPARATION
// ============================================

/**
 * @swagger
 * /api/signalements/{id}/reparation:
 *   post:
 *     summary: Créer/Modifier les infos de réparation
 *     tags: [Signalements - Manager]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               surface_m2:
 *                 type: number
 *                 example: 25.5
 *               budget:
 *                 type: number
 *                 example: 1500000
 *               id_entreprise:
 *                 type: integer
 *                 example: 1
 *               date_debut:
 *                 type: string
 *                 format: date
 *               date_fin_prevue:
 *                 type: string
 *                 format: date
 *               commentaire:
 *                 type: string
 *     responses:
 *       200:
 *         description: Réparation mise à jour
 *       201:
 *         description: Réparation créée
 *       404:
 *         description: Signalement non trouvé
 */
router.post('/:id/reparation',
    authMiddleware,
    managerMiddleware,
    [
        param('id').isInt({ min: 1 }).withMessage('ID signalement invalide'),
        body('surface_m2').optional().isFloat({ min: 0 }).withMessage('Surface invalide'),
        body('budget').optional().isFloat({ min: 0 }).withMessage('Budget invalide'),
        body('id_entreprise').optional().isInt({ min: 1 }).withMessage('ID entreprise invalide'),
        body('date_debut').optional().isISO8601().withMessage('Date début invalide'),
        body('date_fin_prevue').optional().isISO8601().withMessage('Date fin prévue invalide'),
        body('commentaire').optional().isString().withMessage('Commentaire invalide')
    ],
    async (req: Request, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
                return;
            }

            const signalementId = parseInt(req.params.id, 10);
            const { surface_m2, budget, id_entreprise, date_debut, date_fin_prevue, commentaire } = req.body;
            const managerId = req.user?.id;

            // Vérifier que le signalement existe
            const signalement = await SignalementService.findById(signalementId);

            if (!signalement) {
                res.status(404).json({ success: false, error: 'Signalement non trouvé' });
                return;
            }

            // Vérifier si une réparation existe déjà
            const existingResult = await pool.query(
                'SELECT id_reparation FROM Reparation WHERE id_signalement = $1',
                [signalementId]
            );

            let result;

            if (existingResult.rows.length > 0) {
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
        `, [surface_m2 || 0, budget || 0, id_entreprise || 1, date_debut, date_fin_prevue, commentaire, signalementId, managerId]);

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
    }
);

/**
 * @swagger
 * /api/signalements/{id}/status:
 *   put:
 *     summary: Modifier le statut d'un signalement
 *     tags: [Signalements - Manager]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_status
 *             properties:
 *               id_status:
 *                 type: integer
 *                 example: 2
 *               commentaire:
 *                 type: string
 *                 example: "Travaux démarrés"
 *     responses:
 *       200:
 *         description: Statut mis à jour
 *       404:
 *         description: Signalement non trouvé
 */
router.put('/:id/status',
    authMiddleware,
    managerMiddleware,
    [
        param('id').isInt({ min: 1 }).withMessage('ID signalement invalide'),
        body('id_status').isInt({ min: 1, max: 3 }).withMessage('ID statut invalide (1-3)'),
        body('commentaire').optional().isString().withMessage('Commentaire invalide')
    ],
    async (req: Request, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    errors: errors.array()
                });
                return;
            }

            const signalementId = parseInt(req.params.id, 10);
            const { id_status, commentaire } = req.body;
            const managerId = req.user?.id;

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

                // Si terminé (id_status = 3), mettre la date de fin réelle
                if (id_status === 3) {
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
    }
);

/**
 * @swagger
 * /api/signalements/{id}/historique:
 *   get:
 *     summary: Historique des modifications de statut d'un signalement
 *     tags: [Signalements - Manager]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Historique des modifications
 */
router.get('/:id/historique', authMiddleware, async (req: Request, res: Response): Promise<void> => {
    try {
        const signalementId = parseInt(req.params.id, 10);

        if (isNaN(signalementId)) {
            res.status(400).json({ success: false, error: 'ID invalide' });
            return;
        }

        const result = await pool.query(`
      SELECT 
        h.id_historique,
        h.date_modification,
        h.commentaire,
        sa.libelle as ancien_status,
        sa.couleur as ancien_couleur,
        sn.libelle as nouveau_status,
        sn.couleur as nouveau_couleur,
        u.nom as modifie_par_nom,
        u.prenom as modifie_par_prenom
      FROM HistoriqueStatus h
      JOIN Reparation r ON h.id_reparation = r.id_reparation
      LEFT JOIN Status sa ON h.id_status_ancien = sa.id_status
      JOIN Status sn ON h.id_status_nouveau = sn.id_status
      JOIN User_ u ON h.id_user = u.id_user
      WHERE r.id_signalement = $1
      ORDER BY h.date_modification DESC
    `, [signalementId]);

        res.status(200).json({
            success: true,
            count: result.rows.length,
            historique: result.rows.map(row => ({
                id: row.id_historique,
                date: row.date_modification,
                commentaire: row.commentaire,
                ancien_status: row.ancien_status ? {
                    libelle: row.ancien_status,
                    couleur: row.ancien_couleur
                } : null,
                nouveau_status: {
                    libelle: row.nouveau_status,
                    couleur: row.nouveau_couleur
                },
                modifie_par: `${row.modifie_par_prenom || ''} ${row.modifie_par_nom || ''}`.trim()
            }))
        });
    } catch (error: any) {
        console.error('Erreur récupération historique:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

export default router;

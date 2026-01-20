import { Router, Request, Response } from 'express';
import { db } from '../config/firebase.js';
import type { Signalement, SignalementApiResponse } from '../types/signalement.js';

const router = Router();

/**
 * POST /api/signalements
 * Crée un nouveau signalement
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, surfaceM2, budget, latitude, longitude, status, userId, userEmail } = req.body;

    // Validation minimale
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Titre et description requis',
      } as SignalementApiResponse);
    }

    // Créer le document dans Firestore
    const docRef = await db.collection('signalements').add({
      title,
      description,
      surfaceM2: surfaceM2 || null,
      budget: budget || null,
      latitude: latitude || null,
      longitude: longitude || null,
      status: status || 'nouveau',
      userId: userId || null,
      userEmail: userEmail || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: { id: docRef.id },
      message: 'Signalement créé avec succès',
    } as SignalementApiResponse);
  } catch (error) {
    console.error('Erreur lors de la création du signalement:', error);
    res.status(500).json({
      success: false,
      error: 'Impossible de créer le signalement',
    } as SignalementApiResponse);
  }
});

/**
 * GET /api/signalements
 * Récupère tous les signalements
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const snapshot = await db.collection('signalements').get();
    const signalements: Signalement[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      signalements.push({
        id: doc.id,
        title: data.title,
        description: data.description,
        surfaceM2: data.surfaceM2 || null,
        budget: data.budget || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        status: data.status || 'nouveau',
        userId: data.userId || null,
        userEmail: data.userEmail || null,
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate?.() || null,
      });
    });

    // Trier par date décroissante
    signalements.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.getTime() : 0;
      const timeB = b.createdAt ? b.createdAt.getTime() : 0;
      return timeB - timeA;
    });

    const response: SignalementApiResponse = {
      success: true,
      data: signalements,
      message: `${signalements.length} signalements trouvés`,
    };

    res.json(response);
  } catch (error) {
    console.error('Erreur lors de la récupération des signalements:', error);
    res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les signalements',
    } as SignalementApiResponse);
  }
});

/**
 * GET /api/signalements/:id
 * Récupère un signalement par ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const doc = await db.collection('signalements').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Signalement non trouvé',
      } as SignalementApiResponse);
    }

    const data = doc.data();
    const signalement: Signalement = {
      id: doc.id,
      title: data!.title,
      description: data!.description,
      surfaceM2: data!.surfaceM2 || null,
      budget: data!.budget || null,
      latitude: data!.latitude || null,
      longitude: data!.longitude || null,
      status: data!.status || 'nouveau',
      userId: data!.userId || null,
      userEmail: data!.userEmail || null,
      createdAt: data!.createdAt?.toDate() || null,
      updatedAt: data!.updatedAt?.toDate?.() || null,
    };

    res.json({
      success: true,
      data: signalement,
    } as SignalementApiResponse);
  } catch (error) {
    console.error('Erreur lors de la récupération du signalement:', error);
    res.status(500).json({
      success: false,
      error: 'Impossible de récupérer le signalement',
    } as SignalementApiResponse);
  }
});

/**
 * GET /api/signalements/user/:userId
 * Récupère les signalements d'un utilisateur
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const snapshot = await db
      .collection('signalements')
      .where('userId', '==', userId)
      .get();

    const signalements: Signalement[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      signalements.push({
        id: doc.id,
        title: data.title,
        description: data.description,
        surfaceM2: data.surfaceM2 || null,
        budget: data.budget || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        status: data.status || 'nouveau',
        userId: data.userId || null,
        userEmail: data.userEmail || null,
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate?.() || null,
      });
    });

    // Trier par date décroissante
    signalements.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.getTime() : 0;
      const timeB = b.createdAt ? b.createdAt.getTime() : 0;
      return timeB - timeA;
    });

    res.json({
      success: true,
      data: signalements,
      message: `${signalements.length} signalements trouvés pour cet utilisateur`,
    } as SignalementApiResponse);
  } catch (error) {
    console.error('Erreur lors de la récupération des signalements utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les signalements de l\'utilisateur',
    } as SignalementApiResponse);
  }
});

/**
 * GET /api/signalements/status/:status
 * Récupère les signalements par statut
 */
router.get('/status/:status', async (req: Request, res: Response) => {
  try {
    const { status } = req.params;

    const snapshot = await db
      .collection('signalements')
      .where('status', '==', status)
      .get();

    const signalements: Signalement[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      signalements.push({
        id: doc.id,
        title: data.title,
        description: data.description,
        surfaceM2: data.surfaceM2 || null,
        budget: data.budget || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        status: data.status || 'nouveau',
        userId: data.userId || null,
        userEmail: data.userEmail || null,
        createdAt: data.createdAt?.toDate() || null,
        updatedAt: data.updatedAt?.toDate?.() || null,
      });
    });

    // Trier par date décroissante
    signalements.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.getTime() : 0;
      const timeB = b.createdAt ? b.createdAt.getTime() : 0;
      return timeB - timeA;
    });

    res.json({
      success: true,
      data: signalements,
      message: `${signalements.length} signalements trouvés avec le statut '${status}'`,
    } as SignalementApiResponse);
  } catch (error) {
    console.error('Erreur lors de la récupération des signalements par statut:', error);
    res.status(500).json({
      success: false,
      error: 'Impossible de récupérer les signalements',
    } as SignalementApiResponse);
  }
});

export default router;

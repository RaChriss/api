import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import UserService from '../services/userService';
import LoginAttemptService from '../services/loginAttemptService';
import SessionService from '../services/sessionService';
import { hybridDataService } from '../services/hybridDataService';
import { connectionMiddleware } from '../middleware/connection';
import { getAuth, getFirestore } from '../config/firebase';
import { getUserTypeName } from '../utils/userTypes';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Inscription d'un nouvel utilisateur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nom
 *               - email
 *               - password
 *             properties:
 *               nom:
 *                 type: string
 *                 example: "Rakoto"
 *               prenom:
 *                 type: string
 *                 example: "Jean"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jean.rakoto@email.mg"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "motdepasse123"
 *     responses:
 *       201:
 *         description: Utilisateur créé avec succès
 *       400:
 *         description: Données invalides
 *       409:
 *         description: Email déjà utilisé
 */
router.post('/register', 
  [
    body('nom').notEmpty().withMessage('Le nom est requis'),
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères')
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

      const { nom, prenom, email, password } = req.body;

      // Vérifier si l'email existe déjà
      const existingUser = await UserService.findByEmail(email);
      if (existingUser) {
        res.status(409).json({
          success: false,
          error: 'Cet email est déjà utilisé'
        });
        return;
      }

      // Créer l'utilisateur dans PostgreSQL
      const user = await UserService.create({
        nom,
        prenom,
        email,
        password,
        id_type_user: 2 // Utilisateur par défaut
      });

      // Essayer de créer l'utilisateur dans Firebase Firestore (si connecté)
      if (await hybridDataService.isFirebaseAvailable()) {
        try {
          const db = getFirestore();
          
          // Créer dans Firestore (collection User_)
          await db.collection('User_').doc(user.id_user.toString()).set({
            id: user.id_user,
            nom,
            prenom: prenom || '',
            email,
            password, // Mot de passe en clair
            date_creation: new Date(),
            est_bloque: false,
            id_type_user: 2
          });
          
          console.log('✅ Utilisateur créé dans Firebase Firestore:', user.id_user);
        } catch (firebaseError: any) {
          console.log('⚠️ Erreur création Firebase:', firebaseError.message);
          // Continuer même si Firebase échoue
        }
      }

      res.status(201).json({
        success: true,
        message: 'Utilisateur créé avec succès',
        user: {
          id: user.id_user,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          date_creation: user.date_creation
        }
      });
    } catch (error: any) {
      console.error('Erreur inscription:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'inscription',
        details: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion d'un utilisateur
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "manager@manager.mg"
 *               password:
 *                 type: string
 *                 example: "admin123"
 *     responses:
 *       200:
 *         description: Connexion réussie
 *       401:
 *         description: Identifiants invalides
 *       403:
 *         description: Compte bloqué
 */
router.post('/login',
  [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis')
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

      const { email, password } = req.body;
      const clientIp = req.ip || req.socket.remoteAddress;

      let user = null;
      let passwordFromDb = '';

      // Mode hybride: En ligne = Firestore, Hors ligne = PostgreSQL
      const isOnline = await hybridDataService.isFirebaseAvailable();
      
      if (isOnline) {
        // ===== MODE EN LIGNE: Chercher dans Firestore =====
        console.log('🌐 Mode en ligne - Recherche dans Firestore...');
        try {
          const db = getFirestore();
          const usersRef = db.collection('User_');
          const snapshot = await usersRef.where('email', '==', email).get();
          
          if (!snapshot.empty) {
            const firebaseUser = snapshot.docs[0].data();
            console.log(`🔍 Utilisateur trouvé dans Firestore: ${email}`);
            
            // Convertir id_type_user si c'est un string (anciennes données)
            let idTypeUser = firebaseUser.id_type_user;
            if (typeof idTypeUser === 'string') {
              const typeMapping: { [key: string]: number } = {
                'type_visiteur': 1,
                'type_utilisateur': 2,
                'type_manager': 3
              };
              idTypeUser = typeMapping[idTypeUser] || 2;
            }
            
            // Stocker le mot de passe pour vérification
            passwordFromDb = firebaseUser.password;
            
            // Construire l'objet user depuis Firestore
            user = {
              id_user: firebaseUser.id || parseInt(snapshot.docs[0].id),
              nom: firebaseUser.nom,
              prenom: firebaseUser.prenom,
              email: firebaseUser.email,
              id_type_user: idTypeUser,
              est_bloque: firebaseUser.est_bloque || false,
              date_creation: firebaseUser.date_creation
            };
            
            // Aussi synchroniser vers PostgreSQL (cache local)
            const existingLocal = await UserService.findByEmail(email);
            if (!existingLocal) {
              try {
                await UserService.createFromFirebase({
                  nom: firebaseUser.nom,
                  prenom: firebaseUser.prenom,
                  email: firebaseUser.email,
                  password: firebaseUser.password,
                  id_type_user: idTypeUser,
                  firebase_uid: firebaseUser.firebase_uid
                });
                console.log(`✅ Utilisateur synchronisé vers PostgreSQL (cache local)`);
              } catch (syncError) {
                console.log(`⚠️ Erreur sync PostgreSQL: ${syncError}`);
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ Erreur Firestore, fallback PostgreSQL: ${error}`);
          // Fallback vers PostgreSQL si erreur Firestore
          user = await UserService.findByEmail(email);
          if (user && user.password) {
            passwordFromDb = user.password;
          }
        }
      } else {
        // ===== MODE HORS LIGNE: Chercher dans PostgreSQL =====
        console.log('📴 Mode hors ligne - Recherche dans PostgreSQL...');
        user = await UserService.findByEmail(email);
        if (user && user.password) {
          passwordFromDb = user.password;
        }
      }
      
      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Email ou mot de passe incorrect'
        });
        return;
      }

      // Vérifier si l'utilisateur est bloqué
      if (user.est_bloque) {
        res.status(403).json({
          success: false,
          error: 'Votre compte est bloqué. Contactez un administrateur.'
        });
        return;
      }

      // Vérifier le mot de passe (comparaison directe en texte clair)
      const isValidPassword = password === passwordFromDb;
      console.log(`🔐 Vérification mot de passe: ${isValidPassword ? '✅ Correct' : '❌ Incorrect'}`);
      
      if (!isValidPassword) {
        // Enregistrer la tentative échouée
        await LoginAttemptService.recordAttempt(user.id_user, false, clientIp);
        
        // Vérifier si l'utilisateur doit être bloqué
        const shouldBlock = await LoginAttemptService.shouldBlockUser(user.id_user, user.id_type_user);
        
        if (shouldBlock) {
          await UserService.blockUser(user.id_user);
          res.status(403).json({
            success: false,
            error: 'Trop de tentatives échouées. Votre compte a été bloqué.'
          });
          return;
        }

        // Obtenir le nombre de tentatives restantes
        const failedAttempts = await LoginAttemptService.getRecentFailedAttempts(user.id_user);
        const limit = await LoginAttemptService.getAttemptLimit(user.id_type_user);
        const remaining = limit - failedAttempts;

        res.status(401).json({
          success: false,
          error: 'Email ou mot de passe incorrect',
          tentatives_restantes: remaining
        });
        return;
      }

      // Connexion réussie - enregistrer la tentative
      await LoginAttemptService.recordAttempt(user.id_user, true, clientIp);

      // Obtenir la durée de session pour ce type d'utilisateur
      const sessionDuration = await SessionService.getSessionDuration(user.id_type_user);

      // Créer une session
      const session = await SessionService.createSession(user.id_user, sessionDuration);

      res.status(200).json({
        success: true,
        message: 'Connexion réussie',
        user: {
          id: user.id_user,
          nom: user.nom,
          prenom: user.prenom,
          email: user.email,
          type_user: user.id_type_user,
          type_user_name: getUserTypeName(user.id_type_user)
        },
        session: {
          token: session.token,
          expires_at: session.date_expiration
        }
      });
    } catch (error: any) {
      console.error('Erreur login:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la connexion',
        details: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Déconnexion de l'utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      await SessionService.invalidateSession(token);
    }

    res.status(200).json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error: any) {
    console.error('Erreur logout:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la déconnexion'
    });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obtenir les informations de l'utilisateur connecté
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Informations utilisateur
 *       401:
 *         description: Non authentifié
 */
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Token manquant'
      });
      return;
    }

    // Vérifier la session
    const session = await SessionService.getSessionByToken(token);
    if (!session) {
      res.status(401).json({
        success: false,
        error: 'Session invalide ou expirée'
      });
      return;
    }

    // Obtenir l'utilisateur
    const user = await UserService.findById(session.id_user);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id_user,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        firebase_uid: user.firebase_uid,
        date_creation: user.date_creation,
        type_user: user.id_type_user,
        type_user_name: getUserTypeName(user.id_type_user),
        est_bloque: user.est_bloque
      },
      session: {
        expires_at: session.date_expiration
      }
    });
  } catch (error: any) {
    console.error('Erreur get me:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @swagger
 * /api/auth/update:
 *   put:
 *     summary: Modifier les informations de l'utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nom:
 *                 type: string
 *               prenom:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour
 *       401:
 *         description: Non authentifié
 */
router.put('/update', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Token manquant'
      });
      return;
    }

    // Vérifier la session
    const session = await SessionService.getSessionByToken(token);
    if (!session) {
      res.status(401).json({
        success: false,
        error: 'Session invalide ou expirée'
      });
      return;
    }

    const { nom, prenom, email, password } = req.body;

    // Vérifier si le nouvel email est déjà utilisé
    if (email) {
      const existingUser = await UserService.findByEmail(email);
      if (existingUser && existingUser.id_user !== session.id_user) {
        res.status(409).json({
          success: false,
          error: 'Cet email est déjà utilisé'
        });
        return;
      }
    }

    // Mettre à jour l'utilisateur
    const updatedUser = await UserService.update(session.id_user, {
      nom,
      prenom,
      email,
      password
    });

    if (!updatedUser) {
      res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Informations mises à jour',
      user: {
        id: updatedUser.id_user,
        nom: updatedUser.nom,
        prenom: updatedUser.prenom,
        email: updatedUser.email,
        date_creation: updatedUser.date_creation
      }
    });
  } catch (error: any) {
    console.error('Erreur update:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/auth/verify-session:
 *   get:
 *     summary: Vérifier si une session est valide
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session valide
 *       401:
 *         description: Session invalide
 */
router.get('/verify-session', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({
        success: false,
        valid: false,
        error: 'Token manquant'
      });
      return;
    }

    const isValid = await SessionService.isSessionValid(token);
    
    if (!isValid) {
      res.status(401).json({
        success: false,
        valid: false,
        error: 'Session invalide ou expirée'
      });
      return;
    }

    res.status(200).json({
      success: true,
      valid: true
    });
  } catch (error: any) {
    console.error('Erreur verify-session:', error);
    res.status(500).json({
      success: false,
      valid: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @swagger
 * /api/auth/user-types:
 *   get:
 *     summary: Obtenir tous les types d'utilisateurs
 *     tags: [Authentification]
 *     responses:
 *       200:
 *         description: Liste des types d'utilisateurs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 userTypes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 */
router.get('/user-types', async (req: Request, res: Response): Promise<void> => {
  try {
    const { getAllUserTypes } = await import('../utils/userTypes');
    const userTypes = getAllUserTypes();
    
    res.status(200).json({
      success: true,
      userTypes
    });
  } catch (error: any) {
    console.error('Erreur get user types:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * @swagger
 * /api/auth/user-types/{id}:
 *   get:
 *     summary: Obtenir un type d'utilisateur par son ID
 *     tags: [Authentification]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID du type d'utilisateur
 *     responses:
 *       200:
 *         description: Informations du type d'utilisateur
 *       404:
 *         description: Type d'utilisateur non trouvé
 */
router.get('/user-types/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const typeId = parseInt(req.params.id);
    if (isNaN(typeId)) {
      res.status(400).json({
        success: false,
        error: 'ID de type invalide'
      });
      return;
    }

    const { getUserTypeById } = await import('../utils/userTypes');
    const userType = getUserTypeById(typeId);
    
    if (!userType) {
      res.status(404).json({
        success: false,
        error: 'Type d\'utilisateur non trouvé'
      });
      return;
    }

    res.status(200).json({
      success: true,
      userType
    });
  } catch (error: any) {
    console.error('Erreur get user type by id:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

export default router;

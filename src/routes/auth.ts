import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import UserService from '../services/userService';
import { hybridDataService } from '../services/hybridDataService';
import { getAuth, getFirestore } from '../config/firebase';
import { getUserTypeName } from '../utils/userTypes';
import { authMiddleware } from '../middleware/auth';
import { LoginAttemptService } from '../services/loginAttemptService';
import { SessionService } from '../services/sessionService';

const router = Router();

// Firebase Auth REST API URL
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAyyX8ZDCV6nBooeksTO54xvEFDboQzfQw';
const FIREBASE_AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Inscription d'un nouvel utilisateur via Firebase Auth
 *     description: |
 *       Crée un utilisateur dans Firebase Auth et synchronise avec Firestore/PostgreSQL.
 *       Le mot de passe est géré par Firebase Auth (jamais stocké localement).
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
 *                 example: "jean.rakoto@email.mg"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "motdepasse123"
 *               displayName:
 *                 type: string
 *                 example: "Jean Rakoto"
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
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
    body('displayName').optional().isString().withMessage('Le nom doit être une chaîne de caractères')
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

      const { email, password, displayName } = req.body;

      // Vérifier si Firebase est disponible
      const isOnline = await hybridDataService.isFirebaseAvailable();

      if (!isOnline) {
        res.status(503).json({
          success: false,
          error: 'Inscription impossible en mode hors ligne. Connexion internet requise.'
        });
        return;
      }

      try {
        const auth = getAuth();
        const db = getFirestore();

        // Créer l'utilisateur dans Firebase Auth
        const userRecord = await auth.createUser({
          email,
          password,
          displayName: displayName || email.split('@')[0]
        });

        console.log(`✅ Utilisateur Firebase Auth créé: ${userRecord.uid}`);

        // Créer le profil utilisateur dans Firestore (collection User_)
        // INCLUT le mot de passe en clair pour la synchronisation hors ligne
        await db.collection('User_').doc(userRecord.uid).set({
          firebase_uid: userRecord.uid,
          email,
          password, // Mot de passe en clair pour sync hors ligne
          display_name: displayName || email.split('@')[0],
          type_user: 2, // Utilisateur par défaut
          est_bloque: false,
          date_creation: new Date()
        });

        console.log(`✅ Profil Firestore créé pour: ${email}`);

        // Synchroniser vers PostgreSQL (cache local) avec mot de passe
        await UserService.syncFromFirebase({
          firebase_uid: userRecord.uid,
          email,
          password, // Mot de passe pour mode hors ligne
          display_name: displayName || email.split('@')[0],
          type_user: 2
        });

        res.status(201).json({
          success: true,
          message: 'Utilisateur créé avec succès',
          user: {
            uid: userRecord.uid,
            email: userRecord.email,
            display_name: userRecord.displayName
          }
        });
      } catch (firebaseError: any) {
        console.error('❌ Erreur Firebase Auth:', firebaseError);

        if (firebaseError.code === 'auth/email-already-exists') {
          res.status(409).json({
            success: false,
            error: 'Cet email est déjà utilisé'
          });
          return;
        }

        res.status(400).json({
          success: false,
          error: 'Erreur lors de la création du compte',
          details: firebaseError.message
        });
      }
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
 * /api/auth/verify-token:
 *   post:
 *     summary: Vérifie un Firebase ID Token et retourne les informations utilisateur
 *     description: |
 *       Utilisé par le client après une connexion Firebase Auth côté client.
 *       Vérifie le token et synchronise l'utilisateur localement.
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Firebase ID Token obtenu côté client
 *     responses:
 *       200:
 *         description: Token valide, informations utilisateur retournées
 *       401:
 *         description: Token invalide
 */
router.post('/verify-token',
  [
    body('idToken').notEmpty().withMessage('Token requis')
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

      const { idToken } = req.body;
      const isOnline = await hybridDataService.isFirebaseAvailable();

      // Détecter le type de token
      const isFirebaseJWT = idToken.length > 100 && idToken.includes('.');
      const isLocalToken = idToken.startsWith('local_');

      let user: any = null;
      let firebaseUid: string | null = null;

      if (isOnline && isFirebaseJWT) {
        // ===== Firebase ID Token JWT - Vérifier avec Firebase Admin SDK =====
        try {
          const auth = getAuth();
          const db = getFirestore();

          const decodedToken = await auth.verifyIdToken(idToken);
          firebaseUid = decodedToken.uid;

          console.log(`🔐 Token JWT vérifié pour: ${decodedToken.email}`);

          // Récupérer ou créer le profil utilisateur depuis Firestore
          let userDoc = await db.collection('User_').doc(decodedToken.uid).get();
          let userData: any;

          if (!userDoc.exists) {
            // Premier connexion - créer le profil
            userData = {
              firebase_uid: decodedToken.uid,
              email: decodedToken.email,
              password: '',
              display_name: decodedToken.name || decodedToken.email?.split('@')[0] || '',
              type_user: 2,
              est_bloque: false,
              date_creation: new Date()
            };

            await db.collection('User_').doc(decodedToken.uid).set(userData);
            console.log(`✅ Nouveau profil créé pour: ${decodedToken.email}`);
          } else {
            userData = userDoc.data();
          }

          // Vérifier si l'utilisateur est bloqué
          if (userData.est_bloque) {
            res.status(403).json({
              success: false,
              error: 'Votre compte est bloqué. Contactez un administrateur.'
            });
            return;
          }

          // Synchroniser vers PostgreSQL
          user = await UserService.syncFromFirebase({
            firebase_uid: decodedToken.uid,
            email: decodedToken.email || '',
            password: userData.password || '',
            display_name: userData.display_name,
            type_user: userData.type_user || 2
          });
        } catch (firebaseError: any) {
          console.error('❌ Erreur vérification JWT:', firebaseError.message);
          res.status(401).json({
            success: false,
            error: 'Token Firebase invalide ou expiré',
            details: firebaseError.message
          });
          return;
        }
      } else if (isLocalToken) {
        // ===== Token local - Format: local_{id}_{timestamp} =====
        const parts = idToken.split('_');
        if (parts.length >= 2) {
          const userId = parseInt(parts[1]);
          user = await UserService.findById(userId);
          firebaseUid = user?.firebase_uid || null;
        }

        if (!user) {
          res.status(401).json({
            success: false,
            error: 'Session locale expirée'
          });
          return;
        }
      } else {
        // ===== Firebase UID - Rechercher dans PostgreSQL/Firestore =====
        firebaseUid = idToken;

        // Chercher d'abord dans le cache local
        user = await UserService.findByFirebaseUid(idToken);

        // Si en ligne et pas trouvé localement, chercher dans Firestore
        if (!user && isOnline) {
          try {
            const db = getFirestore();
            const userDoc = await db.collection('User_').doc(idToken).get();

            if (userDoc.exists) {
              const userData = userDoc.data()!;

              if (userData.est_bloque) {
                res.status(403).json({
                  success: false,
                  error: 'Votre compte est bloqué. Contactez un administrateur.'
                });
                return;
              }

              user = await UserService.syncFromFirebase({
                firebase_uid: idToken,
                email: userData.email,
                password: userData.password || '',
                display_name: userData.display_name,
                type_user: userData.type_user || 2
              });
            }
          } catch (firestoreError: any) {
            console.warn('⚠️ Erreur Firestore:', firestoreError.message);
          }
        }

        if (!user) {
          res.status(401).json({
            success: false,
            error: 'Session non trouvée. Veuillez vous reconnecter.'
          });
          return;
        }
      }

      // Vérifier si l'utilisateur est bloqué
      if (user.est_bloque) {
        res.status(403).json({
          success: false,
          error: 'Votre compte est bloqué. Contactez un administrateur.'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Session valide',
        user: {
          id: user.id_user,
          firebase_uid: user.firebase_uid,
          email: user.email,
          display_name: user.display_name,
          type_user: user.id_type_user,
          type_user_name: getUserTypeName(user.id_type_user)
        },
        token: user.firebase_uid || `local_${user.id_user}_${Date.now()}`
      });
    } catch (error: any) {
      console.error('Erreur verify-token:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la vérification du token',
        details: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Connexion hybride (Firebase en ligne, PostgreSQL hors ligne)
 *     description: |
 *       En mode en ligne: Vérifie avec Firebase Auth et synchronise vers PostgreSQL.
 *       En mode hors ligne: Vérifie directement dans PostgreSQL.
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
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 example: "motdepasse123"
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
      const ipAddress = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];
      const isOnline = await hybridDataService.isFirebaseAvailable();

      // ===== Vérifier si l'email est bloqué (trop de tentatives) =====
      const blockInfo = await LoginAttemptService.checkBlocking(email);
      if (blockInfo.isBlocked) {
        res.status(429).json({
          success: false,
          error: 'Compte temporairement bloqué suite à trop de tentatives',
          details: {
            tentatives: blockInfo.attempts,
            max_tentatives: blockInfo.maxAttempts,
            tentatives_restantes: blockInfo.remainingAttempts
          }
        });
        return;
      }

      let user: any = null;
      let firebaseUid: string | null = null;
      let mode: 'firebase' | 'postgres' = 'postgres';

      if (isOnline) {
        // ===== MODE EN LIGNE: Authentification via Firebase Auth REST API =====
        console.log('🌐 Mode en ligne - Authentification via Firebase Auth...');

        try {
          // Appel à l'API REST de Firebase Auth (signInWithPassword)
          const authResponse = await fetch(FIREBASE_AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              password,
              returnSecureToken: true
            })
          });

          const authData: any = await authResponse.json();

          if (authResponse.ok && authData.localId) {
            // Authentification Firebase réussie!
            firebaseUid = authData.localId as string;
            const idToken = authData.idToken as string;

            console.log(`✅ Authentification Firebase Auth réussie: ${email} (${firebaseUid})`);

            // Enregistrer la tentative réussie
            await LoginAttemptService.recordAttempt(email, true, ipAddress);

            // Récupérer le profil depuis Firestore
            const db = getFirestore();
            const userDoc = await db.collection('User_').doc(firebaseUid!).get();

            let firebaseUser: any;
            if (userDoc.exists) {
              firebaseUser = userDoc.data()!;

              // Vérifier si bloqué
              if (firebaseUser.est_bloque) {
                res.status(403).json({
                  success: false,
                  error: 'Votre compte est bloqué. Contactez un administrateur.'
                });
                return;
              }

              // Mettre à jour le mot de passe dans Firestore si différent
              if (firebaseUser.password !== password) {
                await db.collection('User_').doc(firebaseUid!).update({ password });
              }
            } else {
              // Créer le profil Firestore s'il n'existe pas
              firebaseUser = {
                firebase_uid: firebaseUid,
                email,
                password,
                display_name: authData.displayName || email.split('@')[0],
                type_user: 2,
                est_bloque: false,
                date_creation: new Date()
              };
              await db.collection('User_').doc(firebaseUid!).set(firebaseUser);
              console.log(`✅ Profil Firestore créé pour: ${email}`);
            }

            // Synchroniser vers PostgreSQL (cache local)
            user = await UserService.syncFromFirebase({
              firebase_uid: firebaseUid || undefined,
              email,
              password, // Synchronise le mot de passe pour mode hors ligne
              display_name: firebaseUser.display_name,
              type_user: firebaseUser.type_user || 2
            });

            mode = 'firebase';
          } else {
            // Erreur d'authentification Firebase - NE PAS faire de fallback PostgreSQL
            const errorMessage = authData.error?.message || 'Authentification échouée';
            console.log(`❌ Firebase Auth erreur: ${errorMessage}`);

            // Enregistrer la tentative échouée
            await LoginAttemptService.recordAttempt(email, false, ipAddress, errorMessage);

            // En mode en ligne, on fait confiance à Firebase Auth uniquement
            res.status(401).json({
              success: false,
              error: 'Email ou mot de passe incorrect'
            });
            return;
          }
        } catch (firebaseError: any) {
          // Erreur réseau/technique - on peut faire fallback vers PostgreSQL
          console.warn('⚠️ Erreur connexion Firebase Auth, fallback vers PostgreSQL:', firebaseError.message);
        }
      }

      // Mode hors ligne UNIQUEMENT - vérifier dans PostgreSQL
      if (!user && !isOnline) {
        console.log('📴 Mode hors ligne - Vérification dans PostgreSQL (cache local)...');
        user = await UserService.verifyPassword(email, password);

        if (user) {
          console.log(`✅ Mot de passe vérifié dans PostgreSQL pour: ${email}`);
          mode = 'postgres';

          // Enregistrer la tentative réussie
          await LoginAttemptService.recordAttempt(email, true, ipAddress);

          // Vérifier si bloqué
          if (user.est_bloque) {
            res.status(403).json({
              success: false,
              error: 'Votre compte est bloqué. Contactez un administrateur.'
            });
            return;
          }
        } else {
          // Enregistrer la tentative échouée (mode hors ligne)
          await LoginAttemptService.recordAttempt(email, false, ipAddress, 'Invalid credentials (offline mode)');
        }
      }

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Email ou mot de passe incorrect'
        });
        return;
      }

      // Désactiver les anciennes sessions de l'utilisateur avant d'en créer une nouvelle
      await SessionService.deactivateUserSessions(user.id_user);

      // Créer une session dans PostgreSQL avec un token unique
      const sessionToken = SessionService.generateToken();
      const session = await SessionService.createSession(
        user.id_user,
        sessionToken,
        ipAddress,
        userAgent
      );

      res.status(200).json({
        success: true,
        message: 'Connexion réussie',
        mode,
        user: {
          id: user.id_user,
          firebase_uid: user.firebase_uid,
          email: user.email,
          display_name: user.display_name,
          type_user: user.id_type_user,
          type_user_name: getUserTypeName(user.id_type_user)
        },
        token: session.token,
        refresh_token: session.refresh_token,
        expires_at: session.date_expiration
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
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Non authentifié'
      });
      return;
    }

    // Récupérer les données complètes depuis Firestore si en ligne
    let userData = req.user;
    const isOnline = await hybridDataService.isFirebaseAvailable();

    if (isOnline && req.user.firebase_uid) {
      try {
        const db = getFirestore();
        const userDoc = await db.collection('User_').doc(req.user.firebase_uid).get();

        if (userDoc.exists) {
          const firestoreData = userDoc.data()!;
          userData = {
            ...req.user,
            display_name: firestoreData.display_name || req.user.display_name,
            type_user: firestoreData.type_user || req.user.type_user
          };
        }
      } catch (error: any) {
        console.warn('⚠️ Erreur récupération Firestore:', error.message);
      }
    }

    res.status(200).json({
      success: true,
      user: {
        id: userData.id,
        firebase_uid: userData.firebase_uid,
        email: userData.email,
        display_name: userData.display_name,
        type_user: userData.type_user,
        type_user_name: getUserTypeName(userData.type_user),
        est_bloque: userData.est_bloque
      },
      mode: req.dataMode
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
 * /api/auth/update-profile:
 *   put:
 *     summary: Modifier le profil utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profil mis à jour
 *       401:
 *         description: Non authentifié
 */
router.put('/update-profile', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Non authentifié'
      });
      return;
    }

    const { displayName } = req.body;
    const isOnline = await hybridDataService.isFirebaseAvailable();

    if (isOnline && req.user.firebase_uid) {
      try {
        const auth = getAuth();
        const db = getFirestore();

        // Mettre à jour Firebase Auth
        if (displayName) {
          await auth.updateUser(req.user.firebase_uid, {
            displayName
          });
        }

        // Mettre à jour Firestore
        await db.collection('User_').doc(req.user.firebase_uid).update({
          display_name: displayName
        });

        console.log(`✅ Profil Firebase mis à jour pour: ${req.user.email}`);
      } catch (firebaseError: any) {
        console.warn('⚠️ Erreur mise à jour Firebase:', firebaseError.message);
      }
    }

    // Mettre à jour le cache local PostgreSQL
    const updatedUser = await UserService.update(req.user.id, {
      display_name: displayName
    });

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour',
      user: {
        id: updatedUser?.id_user,
        firebase_uid: updatedUser?.firebase_uid,
        email: updatedUser?.email,
        display_name: updatedUser?.display_name
      }
    });
  } catch (error: any) {
    console.error('Erreur update profile:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/auth/sync:
 *   post:
 *     summary: Synchroniser les données utilisateur avec Firebase
 *     description: Force une synchronisation entre Firestore et PostgreSQL
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Synchronisation réussie
 *       401:
 *         description: Non authentifié
 */
router.post('/sync', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Non authentifié'
      });
      return;
    }

    const isOnline = await hybridDataService.isFirebaseAvailable();

    if (!isOnline) {
      res.status(503).json({
        success: false,
        error: 'Synchronisation impossible en mode hors ligne'
      });
      return;
    }

    try {
      const db = getFirestore();

      if (!req.user.firebase_uid) {
        res.status(400).json({
          success: false,
          error: 'Utilisateur sans firebase_uid - synchronisation impossible'
        });
        return;
      }

      const userDoc = await db.collection('User_').doc(req.user.firebase_uid).get();

      if (userDoc.exists) {
        const firestoreData = userDoc.data()!;

        // Synchroniser vers PostgreSQL (inclut le mot de passe pour mode offline)
        await UserService.syncFromFirebase({
          firebase_uid: req.user.firebase_uid,
          email: firestoreData.email || req.user.email,
          password: firestoreData.password || '',
          display_name: firestoreData.display_name,
          type_user: firestoreData.type_user || 2
        });

        res.status(200).json({
          success: true,
          message: 'Synchronisation réussie',
          synced_at: new Date()
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Profil utilisateur non trouvé dans Firestore'
        });
      }
    } catch (firebaseError: any) {
      console.error('❌ Erreur synchronisation:', firebaseError);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la synchronisation',
        details: firebaseError.message
      });
    }
  } catch (error: any) {
    console.error('Erreur sync:', error);
    res.status(500).json({
      success: false,
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

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Déconnexion de l'utilisateur
 *     description: Invalide la session active de l'utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Déconnexion réussie
 *       401:
 *         description: Non authentifié
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
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
 * /api/auth/refresh-token:
 *   post:
 *     summary: Rafraîchir le token de session
 *     description: Utilise le refresh_token pour obtenir un nouveau token d'accès
 *     tags: [Authentification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *                 description: Le refresh token obtenu lors du login
 *     responses:
 *       200:
 *         description: Nouveau token généré
 *       401:
 *         description: Refresh token invalide ou expiré
 */
router.post('/refresh-token',
  [
    body('refresh_token').notEmpty().withMessage('Refresh token requis')
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

      const { refresh_token } = req.body;
      const session = await SessionService.refreshSession(refresh_token);

      if (!session) {
        res.status(401).json({
          success: false,
          error: 'Refresh token invalide ou expiré'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Token rafraîchi avec succès',
        token: session.token,
        refresh_token: session.refresh_token,
        expires_at: session.date_expiration
      });
    } catch (error: any) {
      console.error('Erreur refresh token:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du rafraîchissement du token'
      });
    }
  }
);

/**
 * @swagger
 * /api/auth/sessions:
 *   get:
 *     summary: Obtenir les sessions actives de l'utilisateur
 *     tags: [Authentification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des sessions actives
 *       401:
 *         description: Non authentifié
 */
router.get('/sessions', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        error: 'Non authentifié'
      });
      return;
    }

    const sessions = await SessionService.getUserActiveSessions(req.user.id);

    // Masquer les tokens complets pour la sécurité
    const safeSessions = sessions.map(s => ({
      id: s.id_session,
      date_creation: s.date_creation,
      date_expiration: s.date_expiration,
      ip_address: s.ip_address,
      user_agent: s.user_agent
    }));

    res.status(200).json({
      success: true,
      sessions: safeSessions,
      count: sessions.length
    });
  } catch (error: any) {
    console.error('Erreur get sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

export default router;

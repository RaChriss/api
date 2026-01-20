import { Request, Response, NextFunction } from 'express';
import SessionService from '../services/sessionService';
import UserService from '../services/userService';

// Étend l'interface Request pour inclure l'utilisateur
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        nom: string;
        prenom: string;
        email: string;
        type_user: number;
        est_bloque: boolean;
      };
      session?: {
        token: string;
        expires_at: Date;
      };
    }
  }
}

/**
 * Middleware d'authentification - vérifie le token de session
 */
export async function authMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Token d\'authentification requis',
        code: 'MISSING_TOKEN'
      });
      return;
    }

    const token = authHeader.replace('Bearer ', '');

    // Vérifier la session
    const session = await SessionService.getSessionByToken(token);
    
    if (!session) {
      res.status(401).json({
        success: false,
        error: 'Session invalide ou expirée',
        code: 'INVALID_SESSION'
      });
      return;
    }

    // Obtenir l'utilisateur
    const user = await UserService.findById(session.id_user);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Vérifier si l'utilisateur est bloqué
    if (user.est_bloque) {
      res.status(403).json({
        success: false,
        error: 'Votre compte est bloqué',
        code: 'ACCOUNT_BLOCKED'
      });
      return;
    }

    // Ajouter l'utilisateur et la session à la requête
    req.user = {
      id: user.id_user,
      nom: user.nom,
      prenom: user.prenom || '',
      email: user.email,
      type_user: user.id_type_user,
      est_bloque: user.est_bloque
    };

    req.session = {
      token: session.token,
      expires_at: session.date_expiration
    };

    next();
  } catch (error: any) {
    console.error('Erreur middleware auth:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur d\'authentification',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Middleware pour vérifier si l'utilisateur est un Manager (type 3)
 */
export async function managerMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Type 3 = Manager
    if (req.user.type_user !== 3) {
      res.status(403).json({
        success: false,
        error: 'Accès réservé aux managers',
        code: 'MANAGER_ONLY'
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error('Erreur middleware manager:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur de vérification des droits'
    });
  }
}

/**
 * Middleware pour vérifier si l'utilisateur est au moins un Utilisateur (type 2 ou 3)
 */
export async function userMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Type 2 = Utilisateur, Type 3 = Manager
    if (req.user.type_user < 2) {
      res.status(403).json({
        success: false,
        error: 'Accès réservé aux utilisateurs enregistrés',
        code: 'USER_ONLY'
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error('Erreur middleware user:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur de vérification des droits'
    });
  }
}

/**
 * Middleware optionnel - ajoute l'utilisateur si un token est présent mais ne bloque pas
 */
export async function optionalAuthMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const session = await SessionService.getSessionByToken(token);
      
      if (session) {
        const user = await UserService.findById(session.id_user);
        
        if (user && !user.est_bloque) {
          req.user = {
            id: user.id_user,
            nom: user.nom,
            prenom: user.prenom || '',
            email: user.email,
            type_user: user.id_type_user,
            est_bloque: user.est_bloque
          };

          req.session = {
            token: session.token,
            expires_at: session.date_expiration
          };
        }
      }
    }

    next();
  } catch (error: any) {
    // En cas d'erreur, continuer sans authentification
    console.warn('Erreur middleware optionalAuth:', error.message);
    next();
  }
}

export default {
  authMiddleware,
  managerMiddleware,
  userMiddleware,
  optionalAuthMiddleware
};

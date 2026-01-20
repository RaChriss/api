import { Request, Response, NextFunction } from 'express';
import { hybridDataService } from '../services/hybridDataService';

declare global {
  namespace Express {
    interface Request {
      dataMode?: 'firebase' | 'postgres';
      isOnline?: boolean;
    }
  }
}

/**
 * Middleware qui détecte la connexion et définit le mode de données
 */
export const connectionMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Vérifier l'état de la connexion Firebase (utilise le cache si récent)
    const isOnline = hybridDataService.isFirebaseAvailableSync();
    
    // Ajouter les informations de connexion à la requête
    req.isOnline = isOnline;
    req.dataMode = isOnline ? 'firebase' : 'postgres';
    
    // Ajouter un header de réponse pour informer le client
    res.set('X-Data-Source', req.dataMode);
    res.set('X-Firebase-Status', isOnline ? 'connected' : 'offline');
    
    next();
  } catch (error) {
    console.error('Erreur dans connectionMiddleware:', error);
    
    // En cas d'erreur, utiliser PostgreSQL par défaut
    req.isOnline = false;
    req.dataMode = 'postgres';
    res.set('X-Data-Source', 'postgres');
    res.set('X-Firebase-Status', 'error');
    
    next();
  }
};

/**
 * Middleware qui force l'utilisation de Firebase (avec fallback PostgreSQL)
 */
export const requireFirebase = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  const isOnline = hybridDataService.isFirebaseAvailable();
  
  if (!isOnline) {
    console.warn('⚠️ Firebase requis mais indisponible, basculement vers PostgreSQL');
    
    res.set('X-Data-Source', 'postgres');
    res.set('X-Firebase-Status', 'required-but-offline');
    res.set('X-Fallback-Used', 'true');
    
    req.dataMode = 'postgres';
    req.isOnline = false;
  } else {
    req.dataMode = 'firebase';
    req.isOnline = true;
  }
  
  next();
};

/**
 * Middleware qui force l'utilisation de PostgreSQL
 */
export const requirePostgres = (
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  req.dataMode = 'postgres';
  req.isOnline = false;
  
  res.set('X-Data-Source', 'postgres');
  res.set('X-Firebase-Status', 'bypassed');
  
  console.log('💾 Mode PostgreSQL forcé');
  
  next();
};

/**
 * Middleware pour les endpoints de synchronisation uniquement
 */
export const syncOnlyMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  // Ces endpoints nécessitent toujours PostgreSQL pour lire les données non synchronisées
  req.dataMode = 'postgres';
  const isOnline = await hybridDataService.isFirebaseAvailable();
  req.isOnline = isOnline;
  
  res.set('X-Data-Source', 'postgres');
  res.set('X-Firebase-Status', isOnline ? 'available' : 'offline');
  res.set('X-Sync-Mode', 'true');
  
  if (!isOnline) {
    res.status(400).json({
      error: 'Firebase indisponible. Impossible de synchroniser.',
      retry_in: 30,
      current_mode: 'offline'
    });
    return;
  }
  
  next();
};
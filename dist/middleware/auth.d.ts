import { Request, Response, NextFunction } from 'express';
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
            dataMode?: 'firebase' | 'postgres';
            isOnline?: boolean;
        }
    }
}
/**
 * Middleware d'authentification - vérifie le token de session
 */
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Middleware pour vérifier si l'utilisateur est un Manager (type 3)
 */
export declare function managerMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Middleware pour vérifier si l'utilisateur est au moins un Utilisateur (type 2 ou 3)
 */
export declare function userMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
/**
 * Middleware optionnel - ajoute l'utilisateur si un token est présent mais ne bloque pas
 */
export declare function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
declare const _default: {
    authMiddleware: typeof authMiddleware;
    managerMiddleware: typeof managerMiddleware;
    userMiddleware: typeof userMiddleware;
    optionalAuthMiddleware: typeof optionalAuthMiddleware;
};
export default _default;
//# sourceMappingURL=auth.d.ts.map
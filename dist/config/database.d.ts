import { Pool } from 'pg';
/**
 * Configuration de la connexion PostgreSQL
 */
declare const pool: Pool;
/**
 * Exécute une requête SQL
 */
export declare function query(text: string, params?: any[]): Promise<import("pg").QueryResult<any>>;
/**
 * Obtient un client pour les transactions
 */
export declare function getClient(): Promise<import("pg").PoolClient>;
/**
 * Vérifie la connexion à la base de données
 */
export declare function checkConnection(): Promise<boolean>;
export default pool;
//# sourceMappingURL=database.d.ts.map
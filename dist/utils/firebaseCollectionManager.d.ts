/**
 * Utilitaires pour la gestion des collections Firebase
 * Fonctions réutilisables pour créer, vider et gérer les collections
 */
export declare class FirebaseCollectionManager {
    private db;
    constructor();
    /**
     * Crée une collection avec des données initiales
     */
    createCollection<T extends Record<string, any>>(collectionName: string, documents: Array<{
        id: string;
        data: T;
    }>): Promise<void>;
    /**
     * Vide complètement une collection
     */
    clearCollection(collectionName: string): Promise<void>;
    /**
     * Vérifie si une collection existe et compte ses documents
     */
    getCollectionInfo(collectionName: string): Promise<{
        exists: boolean;
        documentCount: number;
        documents: string[];
    }>;
    /**
     * Crée toutes les collections de base avec leurs données initiales
     */
    createAllBaseCollections(): Promise<void>;
    /**
     * Crée les collections dynamiques (vides au départ)
     */
    createDynamicCollections(): Promise<void>;
    /**
     * Affiche un résumé de toutes les collections
     */
    showCollectionsSummary(): Promise<void>;
    /**
     * Réinitialise complètement toutes les collections
     */
    resetAllCollections(): Promise<void>;
    /**
     * Ajoute des données d'exemple pour les tests
     */
    addSampleData(): Promise<void>;
}
export default FirebaseCollectionManager;
//# sourceMappingURL=firebaseCollectionManager.d.ts.map
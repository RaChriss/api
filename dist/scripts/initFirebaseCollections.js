"use strict";
/**
 * Script d'initialisation des collections Firebase
 * Crée toutes les collections et documents initiaux basés sur le schéma PostgreSQL
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAllFirebaseCollections = initializeAllFirebaseCollections;
exports.removePlaceholders = removePlaceholders;
exports.checkFirebaseCollections = checkFirebaseCollections;
const firebase_1 = require("../config/firebase");
const admin = __importStar(require("firebase-admin"));
/**
 * Initialise toutes les collections Firebase avec des données par défaut
 */
async function initializeAllFirebaseCollections() {
    console.log('🚀 Début de l\'initialisation des collections Firebase...');
    try {
        // Vérifier la configuration Firebase avant l'initialisation
        const serviceAccountPath = require('path').join(__dirname, '../../firebase-service-account.json');
        if (!require('fs').existsSync(serviceAccountPath)) {
            throw new Error(`Fichier de configuration manquant: ${serviceAccountPath}`);
        }
        // Initialisation Firebase avec gestion d'erreur
        let firebaseApp;
        try {
            firebaseApp = (0, firebase_1.initializeFirebase)();
            if (!firebaseApp) {
                throw new Error('Impossible d\'initialiser Firebase - application nulle');
            }
        }
        catch (error) {
            console.error('❌ Erreur d\'initialisation Firebase:', error.message);
            if (error.message.includes('no configuration corresponding')) {
                console.log('📝 Vérifiez que le project_id dans firebase-service-account.json est correct');
                console.log('📝 Project ID actuel: mapmobile-31594');
            }
            throw error;
        }
        const db = (0, firebase_1.getFirestore)();
        const batch = db.batch();
        // 1. Créer les types d'utilisateurs
        console.log('📁 Création de la collection TypeUser...');
        const typeUsersData = [
            { id: 1, libelle: 'Visiteur' },
            { id: 2, libelle: 'Utilisateur' },
            { id: 3, libelle: 'Manager' }
        ];
        typeUsersData.forEach(typeUser => {
            const ref = db.collection('TypeUser').doc(typeUser.id.toString());
            batch.set(ref, typeUser);
        });
        // 2. Créer les statuts
        console.log('📁 Création de la collection Status...');
        const statusData = [
            { id: 1, libelle: 'Nouveau', couleur: '#FF0000' },
            { id: 2, libelle: 'En cours', couleur: '#FFA500' },
            { id: 3, libelle: 'Terminé', couleur: '#00FF00' }
        ];
        statusData.forEach(status => {
            const ref = db.collection('Status').doc(status.id.toString());
            batch.set(ref, status);
        });
        // 3. Créer les paramètres par type d'utilisateur
        console.log('📁 Création de la collection Parametre...');
        const parametresData = [
            {
                id: 1,
                nom: 'Paramètres Visiteur',
                limite_tentatives: 3,
                duree_session: 3600,
                id_type_user: 1
            },
            {
                id: 2,
                nom: 'Paramètres Utilisateur',
                limite_tentatives: 3,
                duree_session: 7200,
                id_type_user: 2
            },
            {
                id: 3,
                nom: 'Paramètres Manager',
                limite_tentatives: 5,
                duree_session: 14400,
                id_type_user: 3
            }
        ];
        parametresData.forEach(parametre => {
            const ref = db.collection('Parametre').doc(parametre.id.toString());
            batch.set(ref, parametre);
        });
        // 4. Créer les entreprises
        console.log('📁 Création de la collection Entreprise...');
        const entreprisesData = [
            {
                id: 1,
                nom: 'Entreprise Municipal',
                telephone: '+261 20 22 123 45',
                email: 'municipal@antananarivo.mg',
                adresse: 'Antananarivo, Madagascar'
            }
        ];
        entreprisesData.forEach(entreprise => {
            const ref = db.collection('Entreprise').doc(entreprise.id.toString());
            batch.set(ref, entreprise);
        });
        // 5. Créer l'utilisateur Manager par défaut
        console.log('📁 Création de la collection User_...');
        const usersData = [
            {
                id: 1,
                nom: 'Admin',
                prenom: 'Manager',
                email: 'manager@manager.mg',
                password: 'admin', // Mot de passe en clair
                date_creation: admin.firestore.Timestamp.now(),
                est_bloque: false,
                id_type_user: 3
            }
        ];
        usersData.forEach(user => {
            const ref = db.collection('User_').doc(user.id.toString());
            batch.set(ref, user);
        });
        // Exécuter le batch pour les collections de base
        console.log('💾 Sauvegarde des collections de base...');
        await batch.commit();
        // Créer les collections qui dépendent d'autres collections mais sans données initiales
        // (elles seront remplies dynamiquement par l'application)
        console.log('📁 Création des collections vides...');
        // Collection Signalement (vide)
        const signalementRef = db.collection('Signalement').doc('_placeholder');
        await signalementRef.set({
            _placeholder: true,
            _created: admin.firestore.Timestamp.now(),
            _description: 'Collection créée - ce document sera supprimé automatiquement'
        });
        // Collection Reparation (vide)
        const reparationRef = db.collection('Reparation').doc('_placeholder');
        await reparationRef.set({
            _placeholder: true,
            _created: admin.firestore.Timestamp.now(),
            _description: 'Collection créée - ce document sera supprimé automatiquement'
        });
        // Collection HistoriqueStatus (vide)
        const historiqueRef = db.collection('HistoriqueStatus').doc('_placeholder');
        await historiqueRef.set({
            _placeholder: true,
            _created: admin.firestore.Timestamp.now(),
            _description: 'Collection créée - ce document sera supprimé automatiquement'
        });
        // Collection TentativeConnexion (vide)
        const tentativeRef = db.collection('TentativeConnexion').doc('_placeholder');
        await tentativeRef.set({
            _placeholder: true,
            _created: admin.firestore.Timestamp.now(),
            _description: 'Collection créée - ce document sera supprimé automatiquement'
        });
        // Collection Session (vide)
        const sessionRef = db.collection('Session').doc('_placeholder');
        await sessionRef.set({
            _placeholder: true,
            _created: admin.firestore.Timestamp.now(),
            _description: 'Collection créée - ce document sera supprimé automatiquement'
        });
        console.log('✅ Toutes les collections Firebase ont été créées avec succès!');
        console.log('\n📋 Collections créées:');
        console.log('  - TypeUser (3 documents)');
        console.log('  - Status (3 documents)');
        console.log('  - Parametre (3 documents)');
        console.log('  - Entreprise (1 document)');
        console.log('  - User_ (1 document manager)');
        console.log('  - Signalement (vide)');
        console.log('  - Reparation (vide)');
        console.log('  - HistoriqueStatus (vide)');
        console.log('  - TentativeConnexion (vide)');
        console.log('  - Session (vide)');
    }
    catch (error) {
        console.error('❌ Erreur lors de l\'initialisation des collections:', error);
        throw error;
    }
}
/**
 * Supprime tous les documents placeholder créés
 */
async function removePlaceholders() {
    console.log('🧹 Suppression des documents placeholder...');
    try {
        const db = (0, firebase_1.getFirestore)();
        const collections = ['Signalement', 'Reparation', 'HistoriqueStatus', 'TentativeConnexion', 'Session'];
        for (const collectionName of collections) {
            const placeholderRef = db.collection(collectionName).doc('_placeholder');
            const doc = await placeholderRef.get();
            if (doc.exists) {
                await placeholderRef.delete();
                console.log(`  ✅ Placeholder supprimé de ${collectionName}`);
            }
        }
        console.log('✅ Tous les placeholders ont été supprimés');
    }
    catch (error) {
        console.error('❌ Erreur lors de la suppression des placeholders:', error);
    }
}
/**
 * Vérifie l'état des collections Firebase
 */
async function checkFirebaseCollections() {
    console.log('🔍 Vérification des collections Firebase...');
    try {
        const db = (0, firebase_1.getFirestore)();
        const collections = [
            'TypeUser', 'Status', 'Parametre', 'Entreprise',
            'User_', 'Signalement', 'Reparation', 'HistoriqueStatus',
            'TentativeConnexion', 'Session'
        ];
        for (const collectionName of collections) {
            const snapshot = await db.collection(collectionName).get();
            console.log(`  📁 ${collectionName}: ${snapshot.size} document(s)`);
            if (snapshot.size > 0) {
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (!data._placeholder) {
                        console.log(`    - ${doc.id}`);
                    }
                });
            }
        }
        console.log('✅ Vérification terminée');
    }
    catch (error) {
        console.error('❌ Erreur lors de la vérification:', error);
    }
}
/**
 * Fonction principale pour l'initialisation
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'init';
    switch (command) {
        case 'init':
            await initializeAllFirebaseCollections();
            break;
        case 'check':
            await checkFirebaseCollections();
            break;
        case 'clean':
            await removePlaceholders();
            break;
        default:
            console.log('Usage: npm run firebase-init [init|check|clean]');
            console.log('  init  - Initialise toutes les collections');
            console.log('  check - Vérifie l\'état des collections');
            console.log('  clean - Supprime les documents placeholder');
            process.exit(1);
    }
    process.exit(0);
}
// Exécuter seulement si ce fichier est lancé directement
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=initFirebaseCollections.js.map
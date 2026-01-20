#!/usr/bin/env node
/**
 * Script d'exécution pour la gestion des collections Firebase
 * Usage: npm run firebase-setup [command]
 */

import { initializeFirebase } from '../config/firebase';
import FirebaseCollectionManager from '../utils/firebaseCollectionManager';

async function main() {
  const command = process.argv[2] || 'help';
  
  console.log('🔥 FIREBASE COLLECTION MANAGER\n');

  // Initialiser Firebase
  const firebaseApp = initializeFirebase();
  if (!firebaseApp) {
    console.error('❌ Impossible d\'initialiser Firebase');
    console.error('Vérifiez que le fichier firebase-service-account.json est présent');
    process.exit(1);
  }

  const manager = new FirebaseCollectionManager();

  try {
    switch (command) {
      case 'init':
        console.log('🚀 Initialisation complète des collections...\n');
        await manager.createAllBaseCollections();
        await manager.createDynamicCollections();
        console.log('\n✅ Initialisation terminée!');
        break;

      case 'reset':
        console.log('⚠️ Réinitialisation complète...\n');
        await manager.resetAllCollections();
        console.log('\n✅ Réinitialisation terminée!');
        break;

      case 'status':
      case 'info':
        await manager.showCollectionsSummary();
        break;

      case 'sample':
        console.log('📝 Ajout de données d\'exemple...\n');
        await manager.addSampleData();
        console.log('\n✅ Données d\'exemple ajoutées!');
        break;

      case 'clear':
        console.log('🗑️ Vidage de toutes les collections...\n');
        const collections = [
          'TypeUser', 'Status', 'Parametre', 'Entreprise',
          'User_', 'Signalement', 'Reparation', 'HistoriqueStatus',
          'TentativeConnexion', 'Session'
        ];
        
        for (const collection of collections) {
          await manager.clearCollection(collection);
        }
        console.log('\n✅ Toutes les collections ont été vidées!');
        break;

      case 'help':
      default:
        console.log('📋 COMMANDES DISPONIBLES:\n');
        console.log('  init    - Initialise toutes les collections avec les données de base');
        console.log('  reset   - Réinitialise complètement toutes les collections');
        console.log('  status  - Affiche l\'état de toutes les collections');
        console.log('  sample  - Ajoute des données d\'exemple pour les tests');
        console.log('  clear   - Vide toutes les collections');
        console.log('  help    - Affiche cette aide\n');
        console.log('📖 EXEMPLES:');
        console.log('  npm run firebase-setup init');
        console.log('  npm run firebase-setup status');
        console.log('  npm run firebase-setup sample\n');
        break;
    }

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Exécuter seulement si ce script est lancé directement
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
}

export { main };
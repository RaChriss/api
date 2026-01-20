/**
 * Script de test de la connexion Firebase
 * Teste la validité des credentials et la connexion à Firestore
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

async function testFirebaseConnection(): Promise<void> {
  console.log('🔍 Test de connexion Firebase...\n');

  try {
    // 1. Vérifier le fichier de credentials
    const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');
    console.log('📁 Chemin du fichier credentials:', serviceAccountPath);
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error('❌ Fichier firebase-service-account.json introuvable');
    }
    console.log('✅ Fichier de credentials trouvé');

    // 2. Charger et vérifier les credentials
    const serviceAccount = require(serviceAccountPath);
    console.log('📋 Project ID:', serviceAccount.project_id);
    console.log('📧 Client Email:', serviceAccount.client_email);
    console.log('🔑 Private Key ID:', serviceAccount.private_key_id?.substring(0, 10) + '...');

    // 3. Tester l'initialisation Firebase
    console.log('\n🚀 Initialisation Firebase Admin SDK...');
    
    // Vérifier si déjà initialisé
    try {
      const existingApp = admin.app();
      if (existingApp) {
        console.log('✅ Firebase déjà initialisé');
      }
    } catch (error) {
      // Pas encore initialisé, on peut continuer
      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin SDK initialisé avec succès');
    }

    // 4. Tester la connexion Firestore
    console.log('\n📊 Test de connexion Firestore...');
    const db = admin.firestore();
    
    // Test simple d'accès à Firestore
    const testCollection = db.collection('_connection_test');
    const testDoc = testCollection.doc('test');
    
    await testDoc.set({
      timestamp: admin.firestore.Timestamp.now(),
      test: 'connection_ok'
    });
    console.log('✅ Écriture test Firestore réussie');

    const snapshot = await testDoc.get();
    if (snapshot.exists) {
      console.log('✅ Lecture test Firestore réussie');
      console.log('📄 Données:', snapshot.data());
    }

    // Nettoyer le document de test
    await testDoc.delete();
    console.log('✅ Nettoyage terminé');

    // 5. Tester les collections prévues
    console.log('\n📁 Vérification des collections...');
    const collections = ['TypeUser', 'Status', 'User_', 'Signalement'];
    
    for (const collectionName of collections) {
      try {
        const collectionSnapshot = await db.collection(collectionName).limit(1).get();
        console.log(`  📂 ${collectionName}: ${collectionSnapshot.size} document(s)`);
      } catch (error) {
        console.log(`  📂 ${collectionName}: Collection non accessible`);
      }
    }

    console.log('\n✅ Tous les tests Firebase sont passés avec succès!');
    console.log('🌐 Firebase est opérationnel et les credentials sont valides');

  } catch (error: any) {
    console.error('\n❌ Erreur de connexion Firebase:', error.message);
    
    if (error.message.includes('no configuration corresponding')) {
      console.log('\n🔧 Solutions possibles:');
      console.log('1. Vérifiez que le project_id est correct dans firebase-service-account.json');
      console.log('2. Vérifiez que le projet Firebase existe dans la console');
      console.log('3. Vérifiez que les permissions Firestore sont activées');
      console.log('4. Régénérez une nouvelle clé de service depuis la console Firebase');
    }

    if (error.message.includes('Invalid JWT')) {
      console.log('\n🔧 Solutions possibles:');
      console.log('1. Vérifiez que l\'heure système est synchronisée');
      console.log('2. Régénérez une nouvelle clé de service');
      console.log('3. Vérifiez que la clé n\'a pas été révoquée');
    }

    process.exit(1);
  }
}

// Exécuter le test
if (require.main === module) {
  testFirebaseConnection()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { testFirebaseConnection };
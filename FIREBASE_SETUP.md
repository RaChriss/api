# 🔥 Guide d'initialisation Firebase

Ce guide explique comment initialiser toutes les collections Firebase pour votre projet de gestion des travaux routiers.

## 📋 Prérequis

1. **Configuration Firebase** :
   - Téléchargez votre clé de service depuis la Console Firebase
   - Renommez le fichier en `firebase-service-account.json`
   - Placez-le dans le dossier `api/` (racine du projet API)

2. **Installation des dépendances** :
   ```bash
   cd api
   npm install
   ```

## 🚀 Commandes disponibles

### Initialisation complète
```bash
npm run firebase-init
```
Crée toutes les collections Firebase avec les données de base :
- TypeUser (3 documents : Visiteur, Utilisateur, Manager)
- Status (3 documents : Nouveau, En cours, Terminé)
- Parametre (3 documents de configuration par type d'utilisateur)
- Entreprise (1 document d'entreprise municipal)
- User_ (1 utilisateur Manager par défaut)
- Collections vides : Signalement, Reparation, HistoriqueStatus, TentativeConnexion, Session

### Vérifier l'état des collections
```bash
npm run firebase-status
```
Affiche un résumé de toutes les collections et leur nombre de documents.

### Ajouter des données d'exemple
```bash
npm run firebase-sample
```
Ajoute des signalements et réparations d'exemple pour les tests.

### Réinitialiser complètement
```bash
npm run firebase-reset
```
⚠️ **ATTENTION** : Supprime toutes les données et recrée les collections avec les données de base.

### Vider toutes les collections
```bash
npm run firebase-clear
```
⚠️ **ATTENTION** : Supprime tous les documents de toutes les collections.

## 📊 Collections créées

### Collections de configuration (avec données initiales)

| Collection | Description | Documents |
|------------|-------------|-----------|
| **TypeUser** | Types d'utilisateurs | `type_visiteur`, `type_utilisateur`, `type_manager` |
| **Status** | Statuts des signalements/réparations | `status_nouveau`, `status_en_cours`, `status_termine` |
| **Parametre** | Paramètres par type d'utilisateur | `param_visiteur`, `param_utilisateur`, `param_manager` |
| **Entreprise** | Entreprises de construction | `entreprise_municipal` |
| **User_** | Utilisateurs du système | `user_admin_manager` |

### Collections dynamiques (vides au départ)

| Collection | Description |
|------------|-------------|
| **Signalement** | Signalements de problèmes routiers |
| **Reparation** | Réparations planifiées/en cours |
| **HistoriqueStatus** | Historique des changements de statut |
| **TentativeConnexion** | Tentatives de connexion (sécurité) |
| **Session** | Sessions actives des utilisateurs |

## 👤 Utilisateur par défaut

**Email** : `manager@manager.mg`  
**Mot de passe** : `admin123`  
**Type** : Manager  

## 🔧 Utilisation dans le code

### Importer les utilitaires Firebase
```typescript
import { initializeFirebase, getFirestore } from './config/firebase';
import FirebaseCollectionManager from './utils/firebaseCollectionManager';
```

### Initialiser Firebase dans votre application
```typescript
// Dans votre server.ts
import { initializeFirebase } from './config/firebase';

// Initialiser Firebase au démarrage
const firebaseApp = initializeFirebase();
if (!firebaseApp) {
  console.error('Impossible d\'initialiser Firebase');
  process.exit(1);
}
```

### Utiliser le manager de collections
```typescript
const manager = new FirebaseCollectionManager();

// Vérifier l'état des collections
await manager.showCollectionsSummary();

// Ajouter des données d'exemple
await manager.addSampleData();

// Créer une collection personnalisée
await manager.createCollection('MaCollection', [
  { id: 'doc1', data: { nom: 'Test', valeur: 123 } }
]);
```

## 🔐 Sécurité

- Le fichier `firebase-service-account.json` contient des clés secrètes
- Ne jamais commiter ce fichier dans Git
- Le fichier est déjà ajouté au `.gitignore`
- En production, utilisez des variables d'environnement

## 🐛 Résolution des problèmes

### Erreur "Firebase service account key not found"
- Vérifiez que le fichier `firebase-service-account.json` est présent dans le dossier `api/`
- Vérifiez que le fichier est bien formaté (JSON valide)

### Erreur de permissions Firebase
- Vérifiez que votre clé de service a les permissions Firestore
- Vérifiez que Firestore est activé dans votre projet Firebase

### Erreur TypeScript
- Exécutez `npm run build` pour compiler le TypeScript
- Vérifiez que toutes les dépendances sont installées

## 📝 Développement

Les scripts principaux se trouvent dans :
- [`src/scripts/firebaseSetup.ts`](src/scripts/firebaseSetup.ts) - Script d'exécution principal
- [`src/utils/firebaseCollectionManager.ts`](src/utils/firebaseCollectionManager.ts) - Utilitaires de gestion
- [`src/config/firebase.ts`](src/config/firebase.ts) - Configuration Firebase

Pour modifier les données initiales, éditez le fichier `firebaseCollectionManager.ts` dans la méthode `createAllBaseCollections()`.

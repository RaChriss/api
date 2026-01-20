# Configuration Firebase pour le projet Signalements

## 📋 Prérequis

- Compte Firebase (https://firebase.google.com)
- Accès à la console Firebase
- Google Cloud SDK installé (optionnel)

## 🔧 Configuration Firestore

### 1. Activer Firestore
1. Allez à [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet `fir-project-59287`
3. Cliquez sur **Firestore Database**
4. Cliquez sur **Créer une base de données**
5. Choisissez **Mode de démarrage**: Commencer en mode test
6. Sélectionnez la région: **eur3** (Europe)
7. Cliquez sur **Créer**

### 2. Créer les collections

#### Collection: `signalements`

**Paramètres:**
```
Collection ID: signalements
Auto ID: Oui
```

**Documents avec structure:**
```json
{
  "title": "Nid de poule",
  "description": "Route très abimée",
  "surfaceM2": 2.5,
  "budget": 500000,
  "latitude": -18.8792,
  "longitude": 47.5079,
  "status": "nouveau",
  "userId": "user123",
  "userEmail": "user@example.com",
  "createdAt": timestamp,
  "updatedAt": timestamp
}
```

### 3. Configurer les règles de sécurité

Allez dans **Firestore Database** → **Règles**

Remplacez par:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /signalements/{document=**} {
      // Permettre la lecture publique
      allow read: if true;
      
      // Créer si authentifié
      allow create: if request.auth != null;
      
      // Modifier si propriétaire
      allow update: if request.auth.uid == resource.data.userId;
      
      // Supprimer si propriétaire
      allow delete: if request.auth.uid == resource.data.userId;
    }
  }
}
```

Cliquez sur **Publier**

## 🔑 Obtenir les clés Firebase

### Pour l'app mobile

Les clés sont déjà configurées dans `src/Firebase/FirebaseConfig.ts`:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyBg-pyvhI2rSrg0o-wh75R3eT3jjv-meR4",
  authDomain: "fir-project-59287.firebaseapp.com",
  projectId: "fir-project-59287",
  storageBucket: "fir-project-59287.firebasestorage.app",
  messagingSenderId: "42861926529",
  appId: "1:42861926529:web:e4874bf636adcbf9451580",
  measurementId: "G-T9MRNR6JG8"
};
```

### Pour l'API Backend (Admin SDK)

1. Allez dans **Paramètres du projet** (⚙️)
2. Sélectionnez l'onglet **Comptes de service**
3. Cliquez sur **Générer une nouvelle clé privée**
4. Téléchargez le fichier JSON
5. Copiez les valeurs dans `backend/.env`:

```
FIREBASE_PROJECT_ID=fir-project-59287
FIREBASE_PRIVATE_KEY_ID=xxxxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxxxxx\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@fir-project-59287.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=xxxxx
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
```

⚠️ **NE COMMITEZ JAMAIS CES CLÉS DANS GIT!**

## 🔐 Authentification Firebase

### Activer les méthodes d'authentification

1. Allez dans **Authentication** → **Paramètres de l'authentification**
2. Activez les providers:
   - Email/Mot de passe
   - Google (optionnel)
   - Anonyme (optionnel)

### Configuration dans l'app

L'authentification est déjà intégrée:

```typescript
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
await signInWithEmailAndPassword(auth, email, password);
```

## 🗃️ Structure de données recommandée

### Collection: `signalements`

```
signalements/
├── doc1
│   ├── title: string
│   ├── description: string
│   ├── surfaceM2: number (nullable)
│   ├── budget: number (nullable)
│   ├── latitude: number
│   ├── longitude: number
│   ├── status: "nouveau" | "en_cours" | "termine"
│   ├── userId: string
│   ├── userEmail: string
│   ├── createdAt: timestamp
│   └── updatedAt: timestamp
├── doc2
└── ...
```

### Collection: `users` (optionnel)

```
users/
├── user1
│   ├── email: string
│   ├── displayName: string
│   ├── avatar: string (URL)
│   ├── createdAt: timestamp
│   └── roles: ["user"] | ["admin"]
└── ...
```

### Collection: `comments` (optionnel, pour commentaires sur signalements)

```
signalements/{signalementsId}/comments/
├── comment1
│   ├── text: string
│   ├── userId: string
│   ├── userName: string
│   ├── createdAt: timestamp
│   └── likes: number
└── ...
```

## 📊 Index et optimisation

### Créer des index pour les requêtes fréquentes

1. Allez dans **Firestore Database** → **Index**
2. Créez des index pour:
   - `status` (pour filtrer par statut)
   - `userId` (pour les signalements de l'utilisateur)
   - `createdAt` DESC (pour le tri)

```
Index sur:
- Collection: signalements
- Champs: userId (Ascendant), createdAt (Descendant)

Index sur:
- Collection: signalements
- Champs: status (Ascendant), createdAt (Descendant)
```

## 🔗 Intégration avec l'API Backend

### Configuration Admin SDK

Le backend utilise le Firebase Admin SDK pour:
- Lire les données de Firestore
- Valider les tokens utilisateurs
- Gérer les permissions

### Initialisation (`backend/src/config/firebase.ts`)

```typescript
import * as admin from 'firebase-admin';

admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  clientId: process.env.FIREBASE_CLIENT_ID,
  authUri: process.env.FIREBASE_AUTH_URI,
  tokenUri: process.env.FIREBASE_TOKEN_URI,
});

export const db = admin.firestore();
export const auth = admin.auth();
```

## 🧪 Test des permissions

### Avec Firestore Emulator (local)

```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Télécharger l'émulateur
firebase setup:emulators:firestore

# Lancer l'émulateur
firebase emulators:start

# Accéder à http://localhost:4000
```

## 📈 Monitoring

### Google Cloud Logging

1. Allez dans **Cloud Logging**
2. Observez les logs Firestore
3. Créez des alertes pour les erreurs

### Exemple: Alerte sur erreurs d'accès
```
resource.type="cloud_firestore_database"
severity="ERROR"
```

## 🔄 Sauvegarde

### Activer les sauvegardes automatiques

1. Allez dans **Firestore Database** → **Sauvegardes**
2. Configurez une sauvegarde quotidienne
3. Choisissez une région pour le stockage

## 📚 Ressources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)
- [Firebase Admin SDK](https://firebase.google.com/docs/database/admin/start)
- [Security Rules](https://firebase.google.com/docs/firestore/security/start)
- [Pricing](https://firebase.google.com/pricing)

## 🆘 Dépannage

### Erreur: "Permission denied"
- Vérifiez les règles de sécurité
- Assurez-vous que l'utilisateur est authentifié

### Erreur: "Admin SDK credentials"
- Vérifiez les variables d'environnement dans `backend/.env`
- Assurez-vous que le fichier JSON téléchargé est correct

### Lenteur des requêtes
- Créez des index Firestore
- Limitez la taille des documents
- Utilisez la pagination

### Quota dépassé
- Réduisez la fréquence des requêtes
- Implémentez un cache
- Utilisez les indexe composites

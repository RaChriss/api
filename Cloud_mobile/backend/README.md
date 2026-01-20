# Configuration du Backend API pour Signalements

Ce dossier contient l'API backend qui récupère les données des signalements depuis Firebase Firestore et les expose à votre app web.

## 📋 Structure

```
backend/
├── src/
│   ├── config/
│   │   └── firebase.ts          # Configuration Firebase Admin SDK
│   ├── routes/
│   │   └── signalements.ts      # Routes API pour les signalements
│   ├── types/
│   │   └── signalement.ts       # Types TypeScript
│   └── index.ts                 # Serveur Express principal
├── package.json
├── tsconfig.json
└── .env.example                 # Variables d'environnement exemple
```

## 🚀 Installation et Configuration

### 1. Installer les dépendances

```bash
cd backend
npm install
```

### 2. Configurer Firebase Admin SDK

#### Obtenir les credentials Firebase:

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet `fir-project-59287`
3. Allez dans **Paramètres du projet** → **Comptes de service**
4. Cliquez sur **Générer une nouvelle clé privée**
5. Téléchargez le fichier JSON

#### Configurer les variables d'environnement:

1. Copiez `.env.example` en `.env`
2. Remplissez les valeurs depuis le JSON téléchargé:

```bash
cp .env.example .env
```

Éditer `.env`:
```
FIREBASE_PROJECT_ID=fir-project-59287
FIREBASE_PRIVATE_KEY_ID=xxxxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxxxx\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@fir-project-59287.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=xxxxx
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://localhost:8100
```

⚠️ **Important**: Gardez la clé privée sécurisée! Ne commitez jamais `.env` sur Git.

### 3. Lancer le serveur

**Mode développement:**
```bash
npm run dev
```

**Mode production:**
```bash
npm run build
npm start
```

Le serveur écoutera sur `http://localhost:3000`

## 📡 Endpoints API

### GET `/api/signalements`
Récupère tous les signalements
```bash
curl http://localhost:3000/api/signalements
```

**Réponse:**
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_id",
      "title": "Nid de poule",
      "description": "Route abimée",
      "surfaceM2": 2.5,
      "budget": 500000,
      "latitude": -18.8792,
      "longitude": 47.5079,
      "status": "nouveau",
      "userId": "user123",
      "userEmail": "user@example.com",
      "createdAt": "2024-01-19T10:30:00Z",
      "updatedAt": null
    }
  ],
  "message": "1 signalements trouvés"
}
```

### GET `/api/signalements/:id`
Récupère un signalement par ID
```bash
curl http://localhost:3000/api/signalements/doc_id
```

### GET `/api/signalements/user/:userId`
Récupère les signalements d'un utilisateur
```bash
curl http://localhost:3000/api/signalements/user/user123
```

### GET `/api/signalements/status/:status`
Récupère les signalements par statut (nouveau, en_cours, termine)
```bash
curl http://localhost:3000/api/signalements/status/nouveau
```

### GET `/health`
Vérifie que le serveur est en ligne
```bash
curl http://localhost:3000/health
```

## 🔧 Utilisation dans l'app mobile

Le service API client se trouve dans `src/services/api.ts`:

```typescript
import { fetchAllSignalementsFromApi } from '@/services/api';

// Récupérer tous les signalements
const signalements = await fetchAllSignalementsFromApi();

// Récupérer les signalements d'un utilisateur
const userSignalements = await fetchSignalementsByUser('user123');

// Récupérer par statut
const newSignalements = await fetchSignalementsByStatus('nouveau');
```

## 🔐 Sécurité

### Recommandations:

1. **Variables d'environnement**: Utilisez un gestionnaire de secrets (Doppler, Vault)
2. **CORS**: Limitez les origines autorisées dans `CORS_ORIGIN`
3. **Firebase Rules**: Configurez les règles de sécurité Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /signalements/{document=**} {
      // Lectures publiques
      allow read: if true;
      
      // Créations avec authentification
      allow create: if request.auth != null;
      
      // Modifications/Suppressions uniquement par le propriétaire
      allow update, delete: if request.auth.uid == resource.data.userId;
    }
  }
}
```

4. **Rate Limiting**: Ajouter un middleware de rate limiting en production
5. **Authentication**: Implémenter Firebase Admin Auth pour valider les tokens

## 📦 Déploiement

### Options de déploiement:

#### 1. **Google Cloud Run** (Recommandé)
```bash
gcloud run deploy signalement-api --source .
```

#### 2. **Heroku**
```bash
heroku login
heroku create signalement-api
git push heroku main
```

#### 3. **Railway.app**
```bash
railway link
railway up
```

## 🔄 Architecture

```
Mobile App (Ionic/Vue)
    ↓
    ├─→ Firebase Auth (Authentification)
    ├─→ Firestore (Sauvegarde des signalements)
    └─→ API Backend (Récupération des données)
                ↓
           Express Server
                ↓
           Firebase Admin SDK
                ↓
           Firestore (Lecture)
                ↓
           App Web (Consultation)
```

## 🐛 Dépannage

**Port déjà utilisé:**
```bash
# Changer le port
PORT=3001 npm run dev
```

**Erreurs d'authentification Firebase:**
- Vérifiez les credentials dans `.env`
- Vérifiez que la clé privée est bien formatée (avec `\n` littéraux)

**CORS errors:**
- Vérifiez `CORS_ORIGIN` dans `.env`
- Assurez-vous que l'app web utilise la bonne URL

## 📚 Documentation

- [Firebase Admin SDK](https://firebase.google.com/docs/database/admin/start)
- [Express.js](https://expressjs.com/)
- [TypeScript](https://www.typescriptlang.org/docs/)

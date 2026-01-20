# 📍 Système de Signalements - Cloud Mobile & Web

Plateforme complète de gestion des signalements (nids de poule, routes abimées, etc.) avec app mobile Ionic et portail web.

## 🎯 Fonctionnalités

### App Mobile (Ionic/Vue)
- ✅ Authentification Firebase
- ✅ Création de signalements via formulaire
- ✅ Géolocalisation automatique
- ✅ Affichage interactif sur carte (Leaflet)
- ✅ Liste des mes signalements
- ✅ Filtrage par statut
- ✅ Sauvegarde automatique dans Firestore

### Portail Web
- ✅ Consultation des signalements
- ✅ Tableau de bord avec statistiques
- ✅ Filtrage et recherche
- ✅ Affichage sur carte
- ✅ Export des données
- ✅ Responsive design

### API Backend (Node.js)
- ✅ REST API pour les signalements
- ✅ Requêtes optimisées Firestore
- ✅ CORS configuré
- ✅ Health check
- ✅ Logs structurés

## 🏗️ Architecture

```
Frontend Mobile           Frontend Web
(Ionic/Vue)     →    API Backend    ←    (Vue/Nuxt)
     ↓                    ↓
  Firebase Auth      Admin SDK
     ↓                    ↓
  [Firestore Database]
```

## 📁 Structure du projet

```
.
├── src/                          # Code source frontend mobile
│   ├── views/
│   │   └── Tab1Page.vue         # Interface principale
│   ├── services/
│   │   ├── signalement.ts       # Service Firestore
│   │   └── api.ts               # Client API (nouveau)
│   ├── components/
│   ├── Firebase/
│   │   └── FirebaseConfig.ts   # Config Firebase
│   └── types/
│       └── signalement.ts       # Types TypeScript
├── backend/                      # API Backend (NOUVEAU)
│   ├── src/
│   │   ├── config/
│   │   │   └── firebase.ts      # Config Admin SDK
│   │   ├── routes/
│   │   │   └── signalements.ts  # Routes API
│   │   ├── types/
│   │   │   └── signalement.ts   # Types partagés
│   │   └── index.ts             # Serveur Express
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── README.md
├── ARCHITECTURE.md              # Vue globale du système
├── FIREBASE_CONFIG.md           # Configuration Firestore
├── FRONTEND_API_GUIDE.md        # Guide intégration API
└── README.md                    # Ce fichier
```

## 🚀 Démarrage rapide

### 1. Frontend Mobile

```bash
# Installation
npm install

# Développement
npm run dev
# Ouvre sur http://localhost:5173

# Build Android
ionic capacitor build android

# Build iOS
ionic capacitor build ios
```

### 2. API Backend

```bash
cd backend

# Installation
npm install

# Créer .env depuis .env.example
cp .env.example .env
# Remplir les credentials Firebase

# Développement
npm run dev
# Écoute sur http://localhost:3000

# Production
npm run build
npm start
```

### 3. Test de l'API

```bash
# Récupérer tous les signalements
curl http://localhost:3000/api/signalements

# Vérifier la santé
curl http://localhost:3000/health
```

## 🔐 Configuration Firebase

### Pour l'app mobile (✅ Déjà configuré)

Les credentials sont dans `src/Firebase/FirebaseConfig.ts`:

```typescript
const firebaseConfig = {
  apiKey: "AIzaSyBg-...",
  authDomain: "fir-project-59287.firebaseapp.com",
  projectId: "fir-project-59287",
  // ...
};
```

### Pour le backend (⚠️ À configurer)

1. Allez dans [Firebase Console](https://console.firebase.google.com)
2. **Paramètres** → **Comptes de service**
3. Générez une clé privée JSON
4. Remplissez `backend/.env`:

```env
FIREBASE_PROJECT_ID=fir-project-59287
FIREBASE_PRIVATE_KEY_ID=xxxxx
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxxxx\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@fir-project-59287.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=xxxxx
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

⚠️ **Sécurité**: Ne commitez jamais `.env` dans Git!

## 📡 Endpoints API

| Endpoint | Description |
|----------|-------------|
| `GET /api/signalements` | Tous les signalements |
| `GET /api/signalements/:id` | Signalement par ID |
| `GET /api/signalements/user/:userId` | Signalements utilisateur |
| `GET /api/signalements/status/:status` | Signalements par statut |
| `GET /health` | Vérification serveur |

**Exemple:**
```javascript
// Frontend
import { fetchAllSignalementsFromApi } from '@/services/api';

const signalements = await fetchAllSignalementsFromApi();
```

## 🔄 Flux de données

### Créer un signalement

```
1. User remplit le formulaire (Mobile)
   ↓
2. Clic sur "Envoyer le signalement"
   ↓
3. Vérification Firebase Auth
   ↓
4. Sauvegarde dans Firestore
   ↓
5. Réponse succès
   ↓
6. API Backend peut maintenant récupérer les données
   ↓
7. App Web affiche les données
```

### Consulter un signalement

```
1. App Web lance une requête API
   ↓
2. Backend Firebase Admin SDK interroge Firestore
   ↓
3. Retour JSON avec les données
   ↓
4. Affichage dans la Web UI
```

## 🛠️ Technologies

- **Frontend**: Vue 3, Ionic 8, TypeScript, Vite
- **Mobile**: Capacitor pour Android/iOS
- **Maps**: Leaflet (carte interactive)
- **Backend**: Node.js, Express, TypeScript
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Deployment**: Docker, Google Cloud Run, Heroku

## 📚 Documentation détaillée

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Vue globale du système
2. **[FIREBASE_CONFIG.md](./FIREBASE_CONFIG.md)** - Configuration Firestore
3. **[FRONTEND_API_GUIDE.md](./FRONTEND_API_GUIDE.md)** - Guide d'intégration API
4. **[backend/README.md](./backend/README.md)** - Documentation API Backend

## 🔒 Sécurité

### Firestore Rules (déjà configurées)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /signalements/{document=**} {
      allow read: if true;                              // Lecture publique
      allow create: if request.auth != null;            // Création auth
      allow update, delete: if request.auth.uid == resource.data.userId;  // Modif propriétaire
    }
  }
}
```

### Bonnes pratiques

✅ Variables d'environnement pour les secrets
✅ CORS configuré pour les domaines approuvés
✅ Validation des données côté serveur
✅ Logging des erreurs
✅ Admin SDK côté serveur (clés jamais exposées)

## 🚢 Déploiement

### Frontend Mobile
```bash
npm run build
# APK → Play Store
# IPA → App Store
```

### API Backend
```bash
# Docker
docker build -t signalement-api .
docker run -p 3000:3000 signalement-api

# Ou déployer sur Google Cloud Run
gcloud run deploy signalement-api --source .
```

### Frontend Web (optionnel)
```bash
npm run build
# Déployer dist/ sur:
# - Netlify
# - Vercel
# - Firebase Hosting
# - AWS S3 + CloudFront
```

## 💡 Exemples d'utilisation

### Récupérer tous les signalements dans un composant Vue

```vue
<script setup>
import { onMounted, ref } from 'vue';
import { fetchAllSignalementsFromApi } from '@/services/api';

const items = ref([]);
const loading = ref(true);

onMounted(async () => {
  items.value = await fetchAllSignalementsFromApi();
  loading.value = false;
});
</script>

<template>
  <div v-if="loading">Chargement...</div>
  <div v-else>
    <div v-for="item in items" :key="item.id">
      <h3>{{ item.title }}</h3>
      <p>{{ item.description }}</p>
    </div>
  </div>
</template>
```

### Filtrer par statut

```typescript
import { fetchSignalementsByStatus } from '@/services/api';

const nouveaux = await fetchSignalementsByStatus('nouveau');
const enCours = await fetchSignalementsByStatus('en_cours');
const termines = await fetchSignalementsByStatus('termine');
```

### Récupérer les signalements d'un utilisateur

```typescript
import { fetchSignalementsByUser } from '@/services/api';

const userSignalements = await fetchSignalementsByUser(userId);
```

## 🐛 Dépannage

### Port déjà utilisé
```bash
# Changer le port pour le backend
PORT=3001 npm run dev
```

### CORS Error
- Vérifiez `CORS_ORIGIN` dans `backend/.env`
- Assurez-vous que le frontend utilise la bonne URL API

### Firebase Auth Error
- Vérifiez que l'utilisateur est authentifié
- Vérifiez les règles de sécurité Firestore

### Erreur API Backend
```bash
# Vérifier la santé
curl http://localhost:3000/health

# Voir les logs
npm run dev  # Les logs s'affichent en terminal
```

## 🤝 Contribution

Pour contribuer:
1. Fork le projet
2. Créez une branche `feature/new-feature`
3. Commitez vos changements
4. Poussez vers la branche
5. Créez une Pull Request

## 📝 Licence

MIT

## 📞 Support

Pour toute question:
1. Consultez la documentation dans les fichiers `.md`
2. Vérifiez les logs serveur/console
3. Testez avec cURL ou Postman
4. Créez une issue sur GitHub

## ✨ Prochaines améliorations

- [ ] Authentification API avec Firebase Admin Auth
- [ ] Pagination des requêtes API
- [ ] WebSockets pour les mises à jour en temps réel
- [ ] Elasticsearch pour la recherche avancée
- [ ] Notification push
- [ ] Export PDF/Excel
- [ ] Analytics et statistiques
- [ ] Modération des signalements
- [ ] Rate limiting
- [ ] Cache Redis

---

**Version**: 1.0.0  
**Dernière mise à jour**: Janvier 2025

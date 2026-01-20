# Architecture globale: App Mobile + Web + API Backend

## 🏗️ Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                     UTILISATEURS                                │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
   ┌──────────────┐                  ┌──────────────┐
   │  App Mobile  │                  │   App Web    │
   │  (Ionic/Vue) │                  │ (Vue/Nuxt)   │
   └──────────────┘                  └──────────────┘
         │                                    │
         │  Firebase Auth                     │ HTTP API
         │  + Firestore Direct                │
         ▼                                    ▼
   ┌─────────────────────────────────────────────────┐
   │         Firebase Project                        │
   │  ┌──────────────┐         ┌────────────────┐   │
   │  │ Authentication                         │   │
   │  │ (Firebase Auth)       │ Cloud Firestore │   │
   │  └──────────────┘         └────────────────┘   │
   └─────────────────────────────────────────────────┘
                     ▲
                     │ Firebase Admin SDK
                     │
         ┌──────────────────────────┐
         │   API Backend (Node.js)  │
         │                          │
         │  - Routes signalements   │
         │  - Authentication        │
         │  - Logging               │
         │  - Rate Limiting         │
         └──────────────────────────┘
```

## 📱 App Mobile (Ionic/Vue)

**Responsabilités:**
- Authentification Firebase
- Création de nouveaux signalements
- Affichage de la carte Leaflet
- Récupération des signalements directs depuis Firestore
- Géolocalisation et interaction utilisateur

**Fichiers clés:**
- `src/views/Tab1Page.vue` - Interface principale
- `src/services/signalement.ts` - Service Firestore
- `src/Firebase/FirebaseConfig.ts` - Configuration Firebase

## 🌐 App Web

**Responsabilités:**
- Consultation des signalements (lecture seule)
- Filtrage et recherche
- Tableau de bord/statistiques
- Export de données

**Service API:**
- `src/services/api.ts` - Client API

## 🔌 API Backend

**Responsabilités:**
- Exposition des données Firestore via REST API
- Authentification et autorisation
- Logging et monitoring
- CORS management
- Rate limiting
- Cache et optimisation

### Routes disponibles:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/signalements` | Tous les signalements |
| GET | `/api/signalements/:id` | Un signalement par ID |
| GET | `/api/signalements/user/:userId` | Signalements d'un utilisateur |
| GET | `/api/signalements/status/:status` | Signalements par statut |
| GET | `/health` | Vérification du serveur |

## 🔐 Sécurité

### Authentification
- **App Mobile**: Firebase Auth (SSO/Email)
- **API**: Firebase Admin SDK pour la validation
- **App Web**: Optionnel (lecture seule via API)

### Autorisation
- Lecture: Publique via API
- Création: Authentifiés via Mobile
- Modification: Propriétaire uniquement (via Firestore Rules)

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /signalements/{document=**} {
      // Lectures publiques
      allow read: if true;
      
      // Créations avec auth
      allow create: if request.auth != null;
      
      // Mises à jour par propriétaire
      allow update: if request.auth.uid == resource.data.userId;
      
      // Suppressions par propriétaire
      allow delete: if request.auth.uid == resource.data.userId;
    }
  }
}
```

## 📦 Flux de données

### 1. Créer un signalement (Mobile)
```
User Form (Mobile)
    ↓
Firebase Auth Check
    ↓
Firestore Save
    ↓
Success Response
    ↓
List Update (Web via API)
```

### 2. Consulter les signalements (Web)
```
Web Browser
    ↓
API GET /api/signalements
    ↓
Firebase Admin SDK
    ↓
Firestore Query
    ↓
JSON Response
    ↓
Web UI Update
```

## 🚀 Déploiement

### App Mobile
```
Local → Build APK/IPA → Capacitor → Play Store/App Store
```

### App Web
```
Frontend Source → npm build → Dist folder → Static hosting
(Netlify, Vercel, Firebase Hosting, AWS S3)
```

### API Backend
```
Node.js Source → npm build → Docker image → Cloud deployment
(Google Cloud Run, Heroku, AWS Lambda, Railway)
```

## 📊 Technologies utilisées

| Couche | Tech Stack |
|--------|-----------|
| **Frontend Mobile** | Ionic, Vue 3, TypeScript, Leaflet |
| **Frontend Web** | Vue 3, TypeScript, Vite |
| **Backend** | Node.js, Express, TypeScript |
| **Base de données** | Firebase Firestore |
| **Authentification** | Firebase Auth |
| **Hébergement** | Cloud (Google Cloud Run, Heroku, etc.) |

## 🔄 Intégration Continue

### Pipeline de déploiement
```
GitHub Push
    ↓
Tests (npm test)
    ↓
Build (npm run build)
    ↓
Deploy to Cloud
    ↓
Health Check
```

## 📈 Scalabilité

### Optimisations possibles
1. **Caching**: Redis/Memcached pour l'API
2. **CDN**: CloudFlare pour les assets statiques
3. **Database**: Indexation Firestore
4. **Monitoring**: Google Cloud Logging, Sentry

## 📚 Documentation

- [Backend API](./backend/README.md)
- [Frontend API Guide](./FRONTEND_API_GUIDE.md)
- [Firebase Config](./src/Firebase/README.md)
- [Types Signalement](./src/types/signalement.ts)

## 🛠️ Développement local

### Prérequis
```
Node.js 18+
npm ou yarn
Firebase CLI
Docker (optionnel)
```

### Installation
```bash
# Frontend
npm install
npm run dev

# Backend
cd backend
npm install
npm run dev
```

### Variables d'environnement
```
.env.local → Frontend
backend/.env → Backend
```

## 🎯 Prochaines étapes

1. ✅ Configurer Firebase Admin SDK
2. ✅ Déployer l'API Backend
3. ✅ Intégrer l'API dans le Frontend
4. ⚠️ Configurer la sécurité Firestore
5. ⚠️ Ajouter l'authentification API
6. ⚠️ Mettre en place le monitoring
7. ⚠️ Configurer le CI/CD

## 💡 Tips & Tricks

### Développement
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd backend && npm run dev

# Ouvrir les deux
http://localhost:5173 (Frontend)
http://localhost:3000 (API)
```

### Debugging
```javascript
// Backend
console.log('Debug:', req.params);

// Frontend
console.log('Data:', await fetchAllSignalementsFromApi());
```

### Testing API
```bash
curl http://localhost:3000/api/signalements
curl http://localhost:3000/health
```

## ❓ Support

Pour toute question ou problème:
1. Consultez la documentation
2. Vérifiez les logs serveur
3. Testez avec curl/Postman
4. Vérifiez les credentials Firebase

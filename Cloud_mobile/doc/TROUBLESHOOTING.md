# 🔧 Guide de dépannage - Système de signalements

## 🚨 Problèmes courants et solutions

### Backend

#### ❌ "Port 3000 est déjà utilisé"

**Symptôme:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**
```bash
# Option 1: Utiliser un autre port
PORT=3001 npm run dev

# Option 2: Tuer le processus sur le port 3000
# Sur Mac/Linux:
lsof -ti:3000 | xargs kill -9

# Sur Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

#### ❌ "Impossible de se connecter à Firestore"

**Symptôme:**
```
Error: Initialize app failed: Certificate has expired
Error: PERMISSION_DENIED: Missing or insufficient permissions
```

**Solutions:**

1. **Vérifier les credentials Firebase**
```bash
# Dans backend/.env, vérifiez:
FIREBASE_PROJECT_ID=fir-project-59287
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxxxx\n-----END PRIVATE KEY-----\n"
# Attention: Les \n doivent être littéraux, pas des vrais retours à la ligne
```

2. **Regénérer la clé privée**
```
Firebase Console → Paramètres → Comptes de service → Générer nouvelle clé
```

3. **Vérifier les règles Firestore**
```javascript
// Firestore Console → Règles
allow read: if true;  // Les lectures publiques doivent être autorisées
```

#### ❌ "CORS Error: No 'Access-Control-Allow-Origin' header"

**Symptôme:**
```
Access to XMLHttpRequest from origin 'http://localhost:5173' 
has been blocked by CORS policy
```

**Solutions:**

1. **Vérifier CORS_ORIGIN dans backend/.env**
```env
CORS_ORIGIN=http://localhost:5173,http://localhost:8100
```

2. **Relancer le serveur après modifications**
```bash
# Ctrl+C pour arrêter
npm run dev
```

3. **Vérifier que le Frontend utilise la bonne URL API**
```typescript
// src/services/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
console.log('API URL:', API_BASE_URL); // Vérifier dans la console
```

#### ❌ "TypeError: Cannot read property 'toDate' of undefined"

**Symptôme:**
```
Cannot read property 'toDate' of undefined at ...signalements.ts
```

**Solution:**
Les timestamps Firestore ne sont pas au bon format. Utilisez le code actuel qui gère `createdAt?.toDate?.()`.

#### ❌ "Aucune données retournées par l'API"

**Symptôme:**
```json
{
  "success": true,
  "data": [],
  "message": "0 signalements trouvés"
}
```

**Solutions:**

1. **Vérifier les données dans Firestore**
```
Firebase Console → Firestore Database → signalements
```

2. **Ajouter des données de test**
```javascript
// Firestore Console → Add Document
{
  "title": "Test",
  "description": "Description test",
  "latitude": -18.8792,
  "longitude": 47.5079,
  "status": "nouveau"
}
```

3. **Vérifier les logs serveur**
```bash
npm run dev  # Les logs s'affichent en terminal
```

---

### Frontend

#### ❌ "API_URL is not defined" ou erreur VITE_API_URL

**Symptôme:**
```
import.meta.env.VITE_API_URL is undefined
```

**Solutions:**

1. **Créer/Vérifier .env.local**
```bash
cat .env.local
# Doit contenir:
VITE_API_URL=http://localhost:3000
```

2. **Redémarrer le serveur de développement**
```bash
# Ctrl+C
npm run dev
```

3. **Vérifier le fichier dans src/services/api.ts**
```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

#### ❌ "Cannot fetch from http://localhost:3000"

**Symptôme:**
```
Failed to fetch: http://localhost:3000/api/signalements
```

**Vérifications:**

1. **Le backend tourne-t-il?**
```bash
curl http://localhost:3000/health
# Doit retourner: {"status":"OK",...}
```

2. **La bonne URL API est-elle configurée?**
```javascript
// Console du navigateur
console.log(import.meta.env.VITE_API_URL);
```

3. **CORS est-il activé?**
```bash
# Dans backend, npm run dev
# Cherchez le log: CORS enabled for origins
```

#### ❌ "Ionic/Vue components not found"

**Symptôme:**
```
Module not found: Can't resolve '@ionic/vue'
```

**Solution:**
```bash
npm install
npm run dev
```

#### ❌ "Leaflet map not displaying"

**Symptôme:**
```
Leaflet map appears blank/empty
```

**Solutions:**

1. **Vérifier la position initiale**
```typescript
// src/views/Tab1Page.vue
mapInstance = L.map(mapElement.value).setView([-18.8792, 47.5079], 15);
//                                              Latitude  Longitude   Zoom
```

2. **Vérifier que les tuiles de carte chargent**
```javascript
// Dans la console du navigateur
// Cherchez les requêtes vers tile.openstreetmap.org
```

3. **Redimensionner la map après création**
```javascript
setTimeout(() => {
  mapInstance?.invalidateSize();
}, 300);
```

---

### Firebase & Authentification

#### ❌ "Authentification requise"

**Symptôme:**
```
Error: Authentification requise.
```

**Solution:**

1. **Vérifier que l'utilisateur est connecté**
```typescript
// Dans Tab1Page.vue
if (!auth.currentUser) {
  console.log('Pas de user connecté');
  // Implémenter la connexion
}
```

2. **Activer l'authentification Firebase**
```
Firebase Console → Authentication → Sign-in method
Activer: Email/Password (ou Google, etc.)
```

3. **Tester la connexion**
```
firebase.google.com/console
→ Authentication
→ Users → Ajouter un utilisateur de test
```

#### ❌ "Permission denied" en écrivant dans Firestore

**Symptôme:**
```
Error: PERMISSION_DENIED: Missing or insufficient permissions
```

**Solutions:**

1. **Vérifier les Firestore Rules**
```
Firebase Console → Firestore Database → Rules
allow create: if request.auth != null;
```

2. **Vérifier que l'utilisateur est authentifié**
```typescript
const user = auth.currentUser;
if (!user) {
  console.log('Pas d\'utilisateur authentifié');
}
```

3. **Mode test Firestore**
```javascript
// Temporaire pour développement uniquement!
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // ⚠️ À ne pas utiliser en prod!
    }
  }
}
```

---

### Docker & Déploiement

#### ❌ "Cannot find Docker"

**Solution:**
```bash
# Télécharger Docker Desktop
https://www.docker.com/products/docker-desktop
```

#### ❌ "Docker build fails with npm error"

**Symptôme:**
```
npm ERR! Could not install packages
```

**Solution:**
```dockerfile
# Dans backend/Dockerfile, nettoyer le cache
RUN npm ci --only=production --no-audit --no-fund
```

#### ❌ "Container exited with code 1"

**Solution:**
```bash
# Voir les logs
docker logs <container_id>

# Run en mode interactive
docker run -it -p 3000:3000 signalement-api
```

---

### Installation & Configuration

#### ❌ "npm install fails"

**Solutions:**

1. **Nettoyer le cache npm**
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

2. **Utiliser une version LTS de Node**
```bash
# Vérifier la version
node --version  # Doit être 18+

# Mettre à jour via nvm (recommandé)
nvm install 20
nvm use 20
```

#### ❌ "TypeScript errors"

**Symptôme:**
```
error TS2708: Cannot find name 'L'
error TS7016: Could not find a declaration file for module 'leaflet'
```

**Solutions:**

1. **Installer les types**
```bash
npm install --save-dev @types/leaflet
```

2. **Vérifier les imports**
```typescript
import L from 'leaflet';  // ✅ Correct
// import Leaflet from 'leaflet';  // ❌ Faux
```

---

## 📊 Checklist de Dépannage

### Avant de commencer:

- [ ] Node.js 18+ installé
- [ ] Git configuré
- [ ] Firebase Console accès

### Backend:

- [ ] `backend/node_modules/` existe
- [ ] `backend/.env` rempli avec credentials Firebase
- [ ] Firebase Admin SDK credentials corrects
- [ ] Port 3000 disponible (ou changé dans .env)
- [ ] `npm run dev` dans backend/ démarre sans erreurs
- [ ] `curl http://localhost:3000/health` retourne OK

### Frontend:

- [ ] `node_modules/` existe
- [ ] `.env.local` contient `VITE_API_URL=http://localhost:3000`
- [ ] `npm run dev` démarre sans erreurs
- [ ] http://localhost:5173 s'ouvre dans le navigateur
- [ ] Aucun CORS error dans la console du navigateur

### Firebase:

- [ ] Firestore Database créée et activée
- [ ] Collection `signalements` existe
- [ ] Règles de sécurité Firestore correctes
- [ ] Authentication activée
- [ ] Données de test dans Firestore

### API:

- [ ] GET `/api/signalements` retourne des données
- [ ] GET `/health` retourne OK
- [ ] CORS error disparu

---

## 🔍 Debugging avancé

### Logs détaillés du backend

```typescript
// backend/src/index.ts
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});
```

### Logs détaillés du frontend

```typescript
// src/services/api.ts
const response = await fetch(url);
console.log('Status:', response.status);
console.log('Headers:', response.headers);
const data = await response.json();
console.log('Data:', data);
```

### Utiliser Postman

1. Télécharger [Postman](https://www.postman.com/downloads/)
2. Importer `postman_collection.json`
3. Tester chaque endpoint

### Inspecteur de navigateur

```javascript
// Console du navigateur
console.log('API URL:', import.meta.env.VITE_API_URL);
fetch('http://localhost:3000/api/signalements')
  .then(r => r.json())
  .then(d => console.log(d));
```

---

## 📞 Aide supplémentaire

1. **Consulter la documentation**: `ARCHITECTURE.md`, `FIREBASE_CONFIG.md`
2. **Vérifier les logs**: Terminal backend/frontend
3. **Tester avec curl**: `curl -v http://localhost:3000/api/signalements`
4. **Vérifier Firebase Console**: Firestore Rules, Authentification
5. **Réinitialiser complètement**:
   ```bash
   rm -rf node_modules backend/node_modules
   npm install
   cd backend && npm install
   ```

---

**Dernière mise à jour**: Janvier 2025

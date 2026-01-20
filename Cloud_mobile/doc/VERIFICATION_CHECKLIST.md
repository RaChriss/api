# ✅ Checklist de Vérification

Utilisez cette checklist pour vérifier que tout fonctionne correctement.

## 🔧 Installation

- [ ] Node.js 18+ installé (`node --version`)
- [ ] npm fonctionnelle (`npm --version`)
- [ ] Git configuré (`git config --list`)
- [ ] Compte Firebase actif
- [ ] Code editor (VS Code) installé

## 📦 Dépendances

### Frontend
- [ ] `npm install` exécuté dans la racine
- [ ] `node_modules/` existe
- [ ] Pas d'erreurs TypeScript

### Backend
- [ ] `npm install` exécuté dans `backend/`
- [ ] `backend/node_modules/` existe
- [ ] Pas d'erreurs TypeScript

## 🔑 Configuration Firebase

- [ ] Account Google créé
- [ ] Projet Firebase `fir-project-59287` actif
- [ ] Firestore Database créée et activée
- [ ] Collection `signalements` existe dans Firestore
- [ ] Authentication activée dans Firebase

## 🔐 Secrets & Credentials

### Frontend (.env.local)
```
✅ VITE_API_URL=http://localhost:3000
```

- [ ] `.env.local` existe
- [ ] `VITE_API_URL` configurée correctement
- [ ] Fichier .env **PAS** commité

### Backend (.env)
```
✅ FIREBASE_PROJECT_ID=fir-project-59287
✅ FIREBASE_PRIVATE_KEY_ID=<rempli>
✅ FIREBASE_PRIVATE_KEY=<rempli avec \n littéraux>
✅ FIREBASE_CLIENT_EMAIL=<rempli>
✅ FIREBASE_CLIENT_ID=<rempli>
✅ PORT=3000
✅ CORS_ORIGIN=http://localhost:5173
```

- [ ] `backend/.env` existe
- [ ] Tous les champs Firebase remplis
- [ ] Clé privée formatée correctement
- [ ] Fichier .env **PAS** commité
- [ ] `.gitignore` inclut `.env`

## 🚀 Backend API

### Démarrage
```bash
cd backend && npm run dev
```

- [ ] Serveur démarre sans erreurs
- [ ] Message "🚀 API serveur en écoute sur le port 3000"
- [ ] Pas d'erreurs TypeScript
- [ ] Pas d'erreurs Firebase

### Connectivity
```bash
curl http://localhost:3000/health
```

- [ ] Retourne: `{"status":"OK",...}`
- [ ] Status HTTP 200

### Endpoints
```bash
curl http://localhost:3000/api/signalements
```

- [ ] Retourne JSON avec structure correcte
- [ ] Status HTTP 200
- [ ] Tableau `data` présent

## 🌐 Frontend

### Démarrage
```bash
npm run dev
```

- [ ] Serveur démarre sans erreurs
- [ ] Ouvre sur http://localhost:5173
- [ ] Pas d'erreurs TypeScript
- [ ] Vue affiche correctement

### Connexion API
- [ ] Aucun error CORS dans la console
- [ ] Console affiche: "API URL: http://localhost:3000"
- [ ] Peut récupérer les données de l'API

## 📱 App Mobile

### Interface
- [ ] Tab1 (Signalement) affiche la carte
- [ ] Carte chargée avec Leaflet
- [ ] Peut cliquer sur la carte
- [ ] Formulaire s'ouvre au clic

### Géolocalisation
- [ ] Bouton "Utiliser ma position" fonctionne
- [ ] Position mise à jour dans les inputs

### Soumission
- [ ] Remplir formulaire (titre, description)
- [ ] Cliquer "Envoyer le signalement"
- [ ] Message de succès s'affiche
- [ ] Données sauvegardées dans Firestore

**Vérifier dans Firestore:**
```
Firebase Console → Firestore → signalements
Doit voir le nouveau document
```

## 🔄 Flux de données complet

### Test A: Mobile → Firestore
```
1. [ ] Créer signalement dans app mobile
2. [ ] Voir confirmation "succès"
3. [ ] Vérifier dans Firebase Console Firestore
4. [ ] Document créé avec bonnes données
```

### Test B: Firestore → API → Web
```
1. [ ] Signalement créé dans Firestore (ou ajouter manuel)
2. [ ] curl http://localhost:3000/api/signalements
3. [ ] Vérifier JSON retourné
4. [ ] Structure correcte
5. [ ] Données complètes
```

### Test C: API → Frontend Web
```
1. [ ] Importer fetchAllSignalementsFromApi
2. [ ] Appeler la fonction
3. [ ] Console affiche les données
4. [ ] Aucun CORS error
```

## 🔒 Sécurité

### Firestore Rules
```
Firebase Console → Firestore → Rules
```

- [ ] `allow read: if true;` (lectures publiques)
- [ ] `allow create: if request.auth != null;` (création auth)
- [ ] Règles publiées

### Fichiers secrets
- [ ] `backend/.env` dans `.gitignore`
- [ ] `backend/.env` **PAS** commité
- [ ] Clés privées jamais dans les logs
- [ ] Pas de secrets dans le code source

## 📊 Performance & Monitoring

### Logs Backend
```bash
# Terminal backend
npm run dev
```

- [ ] Logs affichent les requêtes
- [ ] Format: `[timestamp] METHOD PATH - STATUS - TIME`
- [ ] Pas d'erreurs non gérées

### Console Frontend
```
F12 → Console
```

- [ ] Aucun erreur Critical
- [ ] Aucun CORS error
- [ ] Aucun "undefined" suspect

## 🔄 Redémarrage complet

Si quelque chose ne fonctionne pas:

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
npm run dev

# Terminal 3: Test API
curl http://localhost:3000/health
```

- [ ] Backend démarre proprement
- [ ] Frontend démarre proprement
- [ ] Health check retourne OK
- [ ] Pas d'erreurs en cascade

## 🚢 Prêt pour production?

### Avant de déployer

- [ ] Tous les tests de la checklist passent ✅
- [ ] `.env` rempli correctement
- [ ] Pas de `console.log()` en debug
- [ ] Firestore Rules sécurisées
- [ ] CORS limité aux domaines approuvés
- [ ] Logs centralisés configurés
- [ ] Monitoring activé
- [ ] Sauvegarde Firestore activée

### Checklist Déploiement

- [ ] `npm run build` réussit (frontend)
- [ ] `npm run build` réussit (backend)
- [ ] `docker build` réussit (backend)
- [ ] Dockerfile testé localement
- [ ] Variables d'environnement prêtes
- [ ] Secrets gérés avec un vault
- [ ] Rate limiting configuré
- [ ] Auth token middleware prêt

## 📞 Si quelque chose manque

| Problème | Checklist |
|----------|-----------|
| API ne répond pas | Backend démarre? Port 3000 libre? Firebase connecté? |
| CORS error | `CORS_ORIGIN` configuré? Backend redémarré? |
| Pas de données | Données dans Firestore? Règles correctes? |
| TypeError | TypeScript compilé? Imports corrects? |
| Port déjà utilisé | `PORT=3001 npm run dev` |

## 🎯 Résumé rapide

Pour vérifier rapidement:

```bash
# Terminal 1
cd backend && npm run dev
# Doit afficher: "API serveur en écoute sur le port 3000"

# Terminal 2
npm run dev
# Doit ouvrir: http://localhost:5173

# Terminal 3
curl http://localhost:3000/health
# Doit retourner: {"status":"OK",...}

curl http://localhost:3000/api/signalements
# Doit retourner: {"success":true,"data":[...],...}
```

✅ Si tout cela fonctionne → **C'est prêt!**

---

**Dernière mise à jour**: Janvier 2025
**Version**: 1.0.0

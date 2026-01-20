# ⚡ Quick Start - 5 minutes pour démarrer

## ✅ Prérequis
- Node.js 18+ installé
- Compte Firebase (vous l'avez déjà ✅)
- Code editor (VS Code, etc.)

---

## 🚀 Démarrage en 5 étapes

### Étape 1: Installation (2 min)

**Windows:**
```bash
setup.bat
```

**Mac/Linux:**
```bash
bash setup.sh
```

### Étape 2: Configurer Firebase Credentials (1 min)

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet: `fir-project-59287`
3. **Paramètres** (⚙️) → **Comptes de service**
4. Cliquez **Générer une nouvelle clé privée**
5. Téléchargez le JSON
6. Ouvrez `backend/.env` et remplissez:

```env
FIREBASE_PROJECT_ID=fir-project-59287
FIREBASE_PRIVATE_KEY_ID=<prendre depuis le JSON>
FIREBASE_PRIVATE_KEY="<copier, remplacer les vraies newlines par \n>"
FIREBASE_CLIENT_EMAIL=<copier depuis le JSON>
FIREBASE_CLIENT_ID=<copier depuis le JSON>
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### Étape 3: Démarrer le Backend (1 min)

```bash
cd backend
npm run dev
```

Vous devez voir:
```
🚀 API serveur en écoute sur le port 3000
```

### Étape 4: Tester l'API (30 sec)

**Terminal 2:**
```bash
curl http://localhost:3000/health
```

Réponse attendue:
```json
{"status":"OK","timestamp":"2025-01-19T..."}
```

### Étape 5: Démarrer le Frontend (30 sec)

**Terminal 3:**
```bash
npm run dev
```

Ouvrez: http://localhost:5173

---

## 🎯 Tester le flux complet

### Dans l'app mobile:
1. Ouvrez Tab1 (Signalement)
2. Cliquez sur la carte
3. Remplissez le formulaire
4. Cliquez "Envoyer le signalement"

### Vérifier dans l'API:
```bash
curl http://localhost:3000/api/signalements
```

Vous devez voir votre nouveau signalement en JSON!

---

## 📚 Ensuite...

- Consultez **ARCHITECTURE.md** pour la vue globale
- Consultez **FRONTEND_API_GUIDE.md** pour l'intégration web
- Utilisez **TROUBLESHOOTING.md** en cas de problème

---

## 🔥 Commandes importantes

### Backend
```bash
cd backend
npm run dev        # Développement
npm run build      # Compilation
npm start          # Production
```

### Frontend
```bash
npm run dev        # Développement
npm run build      # Build production
npm run preview    # Aperçu production
```

### Tester l'API
```bash
# Tous les signalements
curl http://localhost:3000/api/signalements

# Un signalement (remplacer ID)
curl http://localhost:3000/api/signalements/ID

# Par utilisateur
curl http://localhost:3000/api/signalements/user/USER_ID

# Par statut
curl http://localhost:3000/api/signalements/status/nouveau
```

---

## ❌ Problèmes courants

**"Port 3000 déjà utilisé"**
```bash
PORT=3001 npm run dev
```

**"Cannot connect to Firebase"**
- Vérifiez `backend/.env` est rempli correctement
- Vérifiez les `\n` dans FIREBASE_PRIVATE_KEY

**"CORS Error"**
- Vérifiez `CORS_ORIGIN` dans `backend/.env`
- Relancez le serveur

**Plus d'aide?** → Consultez **TROUBLESHOOTING.md**

---

## 🎉 C'est prêt!

Vous avez maintenant:
- ✅ App mobile qui crée des signalements
- ✅ Backend API qui les expose
- ✅ Frontend web qui peut les consommer

**Prochaine étape:** Créer votre portail web en consultant **FRONTEND_API_GUIDE.md** 🚀

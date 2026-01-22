# Migration vers Firebase Authentication - Mode Hybride

## Vue d'ensemble

Cette migration utilise **Firebase Authentication** comme système principal d'authentification en ligne, tout en conservant **PostgreSQL** comme cache local pour le mode hors ligne.

## Architecture Hybride

### Mode en ligne (Firebase disponible)
- Authentification via **Firebase Auth REST API** (`signInWithPassword`)
- Synchronisation automatique vers PostgreSQL
- **Pas de fallback PostgreSQL** si Firebase Auth échoue (identifiants incorrects)

### Mode hors ligne (Firebase non disponible)
- Authentification via PostgreSQL (mot de passe en clair)
- Utilisateurs préalablement synchronisés uniquement

## Types de Tokens Supportés

| Type | Format | Utilisation |
|------|--------|-------------|
| Firebase ID Token (JWT) | `eyJhbGciOi...` (>100 chars, contient `.`) | Client Firebase SDK |
| Firebase UID | `abc123xyz...` | Retourné par `/login` en ligne |
| Token local | `local_{id}_{timestamp}` | Retourné par `/login` hors ligne |

## Changements principaux

### 1. Structure de la table User_ (PostgreSQL)

**Ancienne structure :**
```sql
CREATE TABLE User_(
   Id_user SERIAL PRIMARY KEY,
   nom VARCHAR(50) NOT NULL,
   prenom VARCHAR(50),
   email VARCHAR(100) UNIQUE NOT NULL,
   password VARCHAR(255) NOT NULL,  -- Hashé
   firebase_uid VARCHAR(128),
   date_creation TIMESTAMP,
   est_bloque BOOLEAN,
   Id_type_user INT NOT NULL
);
```

**Nouvelle structure (hybride) :**
```sql
CREATE TABLE User_(
   Id_user SERIAL PRIMARY KEY,
   firebase_uid VARCHAR(128) UNIQUE,  -- Peut être NULL (créé offline)
   email VARCHAR(100) UNIQUE NOT NULL,
   password VARCHAR(255) NOT NULL,    -- Mot de passe EN CLAIR pour offline
   display_name VARCHAR(100),
   Id_type_user INT NOT NULL DEFAULT 2,
   est_bloque BOOLEAN DEFAULT FALSE,
   date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   derniere_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Points clés :**
- ✅ `password` stocké EN CLAIR (même valeur en ligne/hors ligne)
- ✅ `firebase_uid` peut être NULL (utilisateur créé hors ligne)
- ❌ Plus de table Session (tokens gérés différemment)
- ❌ Plus de table TentativeConnexion
- ✅ `derniere_sync` pour le suivi de synchronisation

### 2. Collection Firestore User_

```typescript
// Structure de la collection User_ dans Firestore
{
  firebase_uid: string,      // UID de Firebase Auth (document ID)
  email: string,
  password: string,          // Mot de passe EN CLAIR pour sync offline
  display_name: string,
  type_user: number,         // 1=Visiteur, 2=Utilisateur, 3=Manager
  est_bloque: boolean,
  date_creation: Timestamp
}
```

### 3. Flux d'authentification

#### Inscription (côté API)
```
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "motdepasse123",
  "displayName": "Jean Rakoto"
}

1. Création dans Firebase Auth
2. Création du profil dans Firestore (avec mot de passe en clair)
3. Synchronisation vers PostgreSQL (avec mot de passe en clair)
```

#### Connexion (hybride)
```
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "motdepasse123"
}

Mode ONLINE:
1. Vérifie dans Firestore (collection User_)
2. Si trouvé, synchronise vers PostgreSQL
3. Retourne { token: firebase_uid, ... }

Mode OFFLINE:
1. Vérifie dans PostgreSQL (mot de passe en clair)
2. Retourne { token: "local_{id}_{timestamp}", ... }
```

#### Vérification de token Firebase
```
POST /api/auth/verify-token
{
  "idToken": "<Firebase-ID-Token>"
}

1. Vérifie le token Firebase
2. Synchronise l'utilisateur
3. Retourne le profil
```

#### Authentification des requêtes API
```
Authorization: Bearer <token>

Le token peut être:
- Un Firebase ID Token (vérifié avec Firebase Admin SDK)
- Un firebase_uid (session hors ligne)
- Un "local_{id}_{timestamp}" (session locale)
```

### 4. Mode hors ligne

Quand Firebase n'est pas disponible :
- `/login` vérifie le mot de passe dans PostgreSQL
- Les utilisateurs peuvent se connecter normalement
- Token de session locale généré
- Données servies depuis le cache PostgreSQL

### 5. Endpoints modifiés

| Endpoint | Comportement |
|----------|--------------|
| `POST /api/auth/register` | Crée user Firebase Auth + Firestore (avec password) + PostgreSQL |
| `POST /api/auth/login` | Hybride: Firestore online / PostgreSQL offline |
| `POST /api/auth/verify-token` | Vérifie Firebase ID Token |
| `GET /api/auth/me` | Retourne le profil de l'utilisateur connecté |
| `POST /api/auth/sync` | Synchronise profil Firebase → PostgreSQL |

### 6. Migration de la base de données

Exécutez le script de migration :
```bash
psql -U postgres -d travaux_routiers -f database/migration_firebase_auth.sql
```

⚠️ **Attention** : Ce script :
- Sauvegarde l'ancienne table User_ dans User_backup
- Supprime les tables Session, TentativeConnexion, Parametre
- Crée la nouvelle structure User_ avec password

### 7. Configuration côté client

Le client peut utiliser soit Firebase SDK, soit l'endpoint `/login` :

```javascript
// Option 1: Via Firebase SDK (recommandé online)
import { signInWithEmailAndPassword } from 'firebase/auth';
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const idToken = await userCredential.user.getIdToken();

// Option 2: Via API (fonctionne online ET offline)
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token, user, mode } = await response.json();
// mode = 'online' ou 'offline'
```

### 8. Requêtes authentifiées

```javascript
// Utiliser le token stocké après login
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('authToken');
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return fetch(url, options);
}
```

### 9. Avantages de cette architecture hybride

1. **Fonctionnement offline** : Connexion possible sans internet
2. **Sécurité Firebase** : Gestion avancée des mots de passe côté serveur
3. **Synchronisation automatique** : PostgreSQL toujours à jour
4. **Compatibilité mobile** : Firebase SDK disponible pour iOS/Android
5. **Flexibilité** : Client peut utiliser Firebase SDK ou endpoint /login

### 10. Types d'utilisateurs

Les types restent les mêmes :
- **1 = Visiteur** : Lecture seule
- **2 = Utilisateur** : Peut créer des signalements
- **3 = Manager** : Administration complète

Le type est stocké dans Firestore et synchronisé vers PostgreSQL.

### 11. Sécurité

⚠️ **Note importante** : Le mot de passe est stocké en clair dans Firestore et PostgreSQL pour permettre la connexion hors ligne. Ceci est un compromis pour la fonctionnalité offline. 

Mesures de sécurité :
- Firestore rules pour protéger les documents
- HTTPS obligatoire pour les communications
- Firebase Auth pour la vérification principale

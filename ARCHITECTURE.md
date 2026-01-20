# 🏗️ Architecture de l'Application - Gestion des Travaux Routiers

## 📋 Vue d'ensemble

Cette application utilise une architecture **hybride** combinant Firebase (cloud) et PostgreSQL (local) pour assurer le fonctionnement en mode connecté et hors ligne.

---

## 🔄 Stratégie de Synchronisation

### Mode Connecté (En ligne)

Lorsque l'utilisateur dispose d'une connexion internet :

- ✅ **Firebase** est la source de données principale
- Les signalements sont créés directement dans Firebase
- Les données sont stockées dans le cloud en temps réel
- Synchronisation automatique entre utilisateurs

### Mode Hors Ligne (Sans connexion)

Lorsque l'utilisateur est hors ligne :

- ✅ **PostgreSQL** prend le relais
- Les données sont stockées localement
- L'application continue de fonctionner normalement
- Les signalements sont marqués comme `est_synchronise = FALSE`

---

## 🎯 Flux de Données

```
┌─────────────────┐
│  Utilisateur    │
│   (Mobile)      │
└────────┬────────┘
         │
         ▼
    ┌─────────┐
    │ En ligne? │
    └────┬────┘
         │
    ┌────┴────┐
    │         │
   OUI       NON
    │         │
    ▼         ▼
┌─────────┐  ┌──────────────┐
│Firebase │  │  PostgreSQL  │
│  Cloud  │  │   (Local)    │
└────┬────┘  └──────┬───────┘
     │              │
     │              │
     └──────┬───────┘
            │
            ▼
    ┌──────────────┐
    │   Manager    │
    │  Dashboard   │
    └──────────────┘
```

---

## 👔 Panneau Manager - Synchronisation Manuelle

### Bouton "Synchroniser"

Le Manager dispose d'un bouton de synchronisation dans son interface qui permet de :

1. **Récupérer** les données PostgreSQL (hors ligne)
2. **Envoyer** ces données vers Firebase (cloud)
3. **Marquer** les données comme synchronisées

### Endpoints de Synchronisation

#### POST `/api/firebase/sync/signalements`

Synchronise les signalements de PostgreSQL vers Firebase.

**Processus :**
1. Récupère tous les signalements non synchronisés (`est_synchronise = FALSE`)
2. Crée/met à jour les documents dans Firebase
3. Stocke le `firebase_id` dans PostgreSQL
4. Marque `est_synchronise = TRUE`

**Retour :** `{ synced: number }` - Nombre d'enregistrements synchronisés

#### POST `/api/firebase/sync/users`

Synchronise les utilisateurs de PostgreSQL vers Firebase.

**Processus :**
1. Récupère les utilisateurs sans `firebase_uid`
2. Crée les comptes Firebase Authentication
3. Stocke le `firebase_uid` dans PostgreSQL

**Retour :** `{ synced: number }` - Nombre d'utilisateurs synchronisés

---

## 🗄️ Structure des Données

### PostgreSQL (Base locale)

**Champs de synchronisation :**

```sql
-- Table Signalement
CREATE TABLE Signalement (
    -- ... autres champs ...
    firebase_id VARCHAR(128),           -- ID du document Firebase
    est_synchronise BOOLEAN DEFAULT FALSE,  -- Statut de sync
    -- ... autres champs ...
);

-- Table User_
CREATE TABLE User_ (
    -- ... autres champs ...
    firebase_uid VARCHAR(128),          -- UID Firebase Auth
    -- ... autres champs ...
);
```

### Firebase (Cloud)

**Collections :**

- **`signalements/`** - Signalements des utilisateurs
  - Document ID → stocké dans `Signalement.firebase_id`
  - Champs : location, date_signalement, user_id, status, etc.

- **`users/`** - Profils utilisateurs
  - Document ID → stocké dans `User_.firebase_uid`
  - Champs : nom, prenom, email, type, etc.

---

## 🔐 Gestion de l'Authentification

### Connexion en ligne

1. Authentification Firebase Auth
2. Récupération du `firebase_uid`
3. Vérification/création dans PostgreSQL
4. Génération d'un token de session

### Connexion hors ligne

1. Authentification PostgreSQL uniquement
2. Vérification email/password (bcrypt)
3. Génération d'un token de session
4. Synchronisation ultérieure des credentials

---

## 📊 Scénarios d'Utilisation

### Scénario 1 : Utilisateur connecté

```
Utilisateur Mobile (en ligne)
    │
    ├─> Crée un signalement
    │
    ├─> Envoi vers Firebase ✅
    │
    └─> Disponible immédiatement pour le Manager
```

### Scénario 2 : Utilisateur hors ligne

```
Utilisateur Mobile (hors ligne)
    │
    ├─> Crée un signalement
    │
    ├─> Sauvegarde dans PostgreSQL local
    │
    └─> est_synchronise = FALSE
```

### Scénario 3 : Synchronisation Manager

```
Manager clique sur "Synchroniser"
    │
    ├─> Récupère signalements non synchronisés
    │
    ├─> Envoie vers Firebase
    │   (POST /api/firebase/sync/signalements)
    │
    ├─> Met à jour firebase_id
    │
    └─> est_synchronise = TRUE ✅
```

---

## ⚙️ Configuration

### Variables d'Environnement

```env
# PostgreSQL (Base locale)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=travaux_routiers
DB_USER=postgres
DB_PASSWORD=your_password

# Firebase (Cloud)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Mode de fonctionnement
SYNC_MODE=hybrid  # hybrid | firebase-only | postgres-only
```

---

## 🛠️ Implémentation Technique

### Service de Synchronisation

Le service `firebaseCollectionManager.ts` gère :

- ✅ Détection de connexion internet
- ✅ Basculement automatique Firebase ↔ PostgreSQL
- ✅ File d'attente de synchronisation
- ✅ Gestion des conflits

### Middleware de Détection

Le middleware vérifie :

1. Connectivité internet
2. Disponibilité de Firebase
3. Route vers la base appropriée

---

## 📈 Avantages de cette Architecture

✅ **Résilience** - L'application fonctionne hors ligne  
✅ **Performance** - PostgreSQL pour les requêtes complexes  
✅ **Temps réel** - Firebase pour la synchronisation instantanée  
✅ **Flexibilité** - Le Manager contrôle la synchronisation  
✅ **Sécurité** - Double sauvegarde des données

---

## 🚨 Points d'Attention

⚠️ **Conflits de données** - Gérer les modifications concurrentes  
⚠️ **Cohérence** - Assurer la synchronisation bidirectionnelle  
⚠️ **Quotas Firebase** - Surveiller l'utilisation du service gratuit  
⚠️ **Taille des données** - Optimiser les payloads de synchronisation

---

## 📝 Checklist de Développement

- [ ] Implémenter la détection de connexion
- [ ] Créer les endpoints de synchronisation
- [ ] Ajouter le bouton "Synchroniser" dans l'interface Manager
- [ ] Gérer les conflits de synchronisation
- [ ] Ajouter des logs de synchronisation
- [ ] Tester les scénarios hors ligne
- [ ] Implémenter la synchronisation automatique optionnelle
- [ ] Créer des indicateurs de statut de synchronisation

---

## 🔄 Prochaines Évolutions

1. **Synchronisation automatique** - Déclencher la sync à la reconnexion
2. **Synchronisation bidirectionnelle** - Firebase → PostgreSQL
3. **Résolution de conflits** - Stratégie de fusion automatique
4. **Historique de sync** - Table de logs des synchronisations
5. **Notifications** - Alertes en cas d'échec de synchronisation

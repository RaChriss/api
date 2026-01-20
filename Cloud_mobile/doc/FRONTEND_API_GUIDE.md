# Guide d'Intégration API - Frontend

Ce guide explique comment utiliser l'API backend dans votre application.

## 🔌 Configuration initiale

### 1. Variable d'environnement

Dans `src/main.ts` ou votre fichier de config, assurez-vous que `VITE_API_URL` est configuré:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

Fichier `.env.local`:
```
VITE_API_URL=http://localhost:3000
```

Fichier `.env.production`:
```
VITE_API_URL=https://your-production-api.com
```

## 📱 Utilisation dans les composants Vue

### Exemple: Afficher tous les signalements dans une liste

```vue
<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Tous les signalements</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-spinner v-if="loading"></ion-spinner>
      
      <ion-list v-else-if="signalements.length">
        <ion-item v-for="item in signalements" :key="item.id">
          <ion-label>
            <h2>{{ item.title }}</h2>
            <p>{{ item.description }}</p>
            <p>Statut: {{ item.status }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
      
      <div v-else>Aucun signalement</div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { fetchAllSignalementsFromApi } from '@/services/api';

const signalements = ref([]);
const loading = ref(true);

onMounted(async () => {
  try {
    signalements.value = await fetchAllSignalementsFromApi();
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    loading.value = false;
  }
});
</script>
```

### Exemple: Filtrer par statut

```typescript
import { fetchSignalementsByStatus } from '@/services/api';

const getNewSignalements = async () => {
  const newItems = await fetchSignalementsByStatus('nouveau');
  return newItems;
};

const getInProgressSignalements = async () => {
  const inProgress = await fetchSignalementsByStatus('en_cours');
  return inProgress;
};
```

### Exemple: Récupérer les signalements d'un utilisateur

```typescript
import { fetchSignalementsByUser } from '@/services/api';

const loadUserSignalements = async (userId: string) => {
  const userItems = await fetchSignalementsByUser(userId);
  return userItems;
};
```

## 🔄 Comparaison: Firestore Direct vs API Backend

### ❌ Avant (Accès direct à Firestore)
```typescript
// src/services/signalement.ts
import { getDocs, collection, query, where } from "firebase/firestore";
import { db } from "@/Firebase/FirebaseConfig";

export const fetchAllSignalements = async () => {
  const snapshot = await getDocs(query(collection(db, "signalements")));
  // ...traitement
};
```

**Problèmes:**
- Accès direct aux credentials Firebase exposés
- Pas de contrôle côté serveur
- Difficile à scaler
- Règles de sécurité complexes

### ✅ Après (Via API Backend)
```typescript
// src/services/api.ts
export const fetchAllSignalementsFromApi = async () => {
  const response = await fetch(`${API_BASE_URL}/api/signalements`);
  const result = await response.json();
  return result.data;
};
```

**Avantages:**
- Credentials Firebase sécurisées côté serveur
- Contrôle d'accès centralisé
- Scalabilité améliorée
- Logging et monitoring côté serveur
- API REST standard

## 🚀 Exemple: Tableau de bord web

Voici un exemple complet d'une app web Nuxt/Vue utilisant l'API:

```vue
<template>
  <div class="dashboard">
    <h1>Tableau de bord des signalements</h1>
    
    <!-- Filtres -->
    <div class="filters">
      <button @click="viewMode = 'all'">Tous</button>
      <button @click="viewMode = 'nouveau'">Nouveaux</button>
      <button @click="viewMode = 'en_cours'">En cours</button>
      <button @click="viewMode = 'termine'">Terminés</button>
    </div>

    <!-- Stats -->
    <div class="stats">
      <div>Total: {{ totalCount }}</div>
      <div>Affichés: {{ displayedCount }}</div>
    </div>

    <!-- Liste -->
    <div v-if="loading" class="loading">Chargement...</div>
    <table v-else>
      <thead>
        <tr>
          <th>Titre</th>
          <th>Description</th>
          <th>Statut</th>
          <th>Surface</th>
          <th>Budget</th>
          <th>Créé le</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in filteredSignalements" :key="item.id">
          <td>{{ item.title }}</td>
          <td>{{ item.description }}</td>
          <td>
            <span :class="`status-${item.status}`">{{ item.status }}</span>
          </td>
          <td>{{ item.surfaceM2 }} m²</td>
          <td>{{ item.budget }} MGA</td>
          <td>{{ formatDate(item.createdAt) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  fetchAllSignalementsFromApi,
  fetchSignalementsByStatus,
} from '@/services/api';

const signalements = ref([]);
const loading = ref(true);
const viewMode = ref('all');

const filteredSignalements = computed(() => {
  if (viewMode.value === 'all') {
    return signalements.value;
  }
  return signalements.value.filter(
    (item) => item.status === viewMode.value
  );
});

const totalCount = computed(() => signalements.value.length);
const displayedCount = computed(() => filteredSignalements.value.length);

const loadSignalements = async () => {
  try {
    loading.value = true;
    if (viewMode.value === 'all') {
      signalements.value = await fetchAllSignalementsFromApi();
    } else {
      signalements.value = await fetchSignalementsByStatus(viewMode.value);
    }
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    loading.value = false;
  }
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('fr-FR');
};

onMounted(() => {
  loadSignalements();
});

watch(viewMode, () => {
  loadSignalements();
});
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

.filters {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.filters button {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.stats {
  display: flex;
  gap: 20px;
  margin: 20px 0;
  font-weight: bold;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  border: 1px solid #ddd;
  padding: 12px;
  text-align: left;
}

th {
  background-color: #f4f4f4;
}

.status-nouveau {
  background: #e3f2fd;
  color: #1976d2;
  padding: 4px 8px;
  border-radius: 4px;
}

.status-en_cours {
  background: #fff3e0;
  color: #f57c00;
  padding: 4px 8px;
  border-radius: 4px;
}

.status-termine {
  background: #e8f5e9;
  color: #388e3c;
  padding: 4px 8px;
  border-radius: 4px;
}
</style>
```

## 🔒 Sécurité et authentification

### Ajouter l'authentification à l'API

Si vous voulez protéger certains endpoints, créez un middleware d'authentification:

```typescript
// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebase';

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'Token manquant' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Token invalide' });
  }
};
```

Utilisez-le dans vos routes:
```typescript
import { verifyToken } from '../middleware/auth';

router.get('/user/:userId', verifyToken, async (req, res) => {
  // Endpoint protégé
});
```

## 📊 Monitoring et logs

Ajouter le logging côté serveur:

```typescript
// backend/src/middleware/logging.ts
import { Request, Response, NextFunction } from 'express';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    );
  });

  next();
};
```

## 📈 Optimisation

### Cache côté client
```typescript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let cachedData = null;
let lastFetchTime = 0;

export const fetchAllSignalementsWithCache = async () => {
  const now = Date.now();
  
  if (cachedData && now - lastFetchTime < CACHE_DURATION) {
    return cachedData;
  }

  cachedData = await fetchAllSignalementsFromApi();
  lastFetchTime = now;
  return cachedData;
};
```

### Pagination
```typescript
// Dans le backend:
router.get('/', async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const snapshot = await db
    .collection('signalements')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .offset(skip)
    .get();
  
  // ...
});
```

## ❓ FAQ

**Q: L'API et l'app web doivent-elles être sur le même serveur?**
A: Non, elles peuvent être sur des serveurs différents. Utilisez CORS pour permettre l'accès.

**Q: Comment gérer les erreurs API?**
A: Utilisez try-catch et affichez un message d'erreur à l'utilisateur.

**Q: Comment mettre à jour les données en temps réel?**
A: Utilisez WebSockets ou la fonction `setInterval()` pour recharger les données.

**Q: Comment déployer en production?**
A: Compilez le backend, configurez les variables d'environnement, puis déployez sur une plateforme comme Heroku, AWS Lambda, Google Cloud Run, etc.

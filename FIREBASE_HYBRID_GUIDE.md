# 🔄 Guide de Synchronisation Firebase/PostgreSQL

## 📋 Vue d'ensemble

Ce système utilise une architecture **hybride** qui bascule automatiquement entre Firebase (cloud) et PostgreSQL (local) selon la disponibilité de la connexion internet.

---

## 🚀 Installation et Configuration

### 1. Configurer l'environnement

```bash
# Copier le fichier de configuration
cp .env.example .env

# Modifier les variables d'environnement
nano .env
```

### 2. Variables importantes à configurer

```env
# Mode hybride
SYNC_MODE=hybrid
FIREBASE_CHECK_INTERVAL=30
AUTO_SYNC_ON_RECONNECT=true

# Firebase
FIREBASE_PROJECT_ID=votre-projet-firebase
FIREBASE_PRIVATE_KEY="votre-clé-privée"
FIREBASE_CLIENT_EMAIL=votre-service-account@projet.iam.gserviceaccount.com

# PostgreSQL
DB_HOST=localhost
DB_NAME=travaux_routiers
DB_USER=postgres
DB_PASSWORD=votre-mot-de-passe
```

### 3. Appliquer la migration de base de données

```bash
# Exécuter la migration
psql -U postgres -d travaux_routiers -f database/migration_firebase_sync.sql
```

---

## 🔄 Fonctionnement

### Mode En ligne (Firebase)

```javascript
// Les données sont automatiquement sauvées dans Firebase
const signalement = await hybridDataService.createSignalement({
  location: { latitude: -18.8792, longitude: 47.5079 },
  user_id: 123,
  status_id: 1
});
// Résultat: { id: 'firebase-doc-id', source: 'firebase' }
```

### Mode Hors ligne (PostgreSQL)

```javascript
// Basculement automatique vers PostgreSQL
const signalement = await hybridDataService.createSignalement({
  location: { latitude: -18.8792, longitude: 47.5079 },
  user_id: 123,
  status_id: 1
});
// Résultat: { id: '456', source: 'postgres' }
// est_synchronise = FALSE dans PostgreSQL
```

---

## 👔 Interface Manager - Synchronisation

### Bouton "Synchroniser"

L'interface Manager dispose d'un bouton pour déclencher manuellement la synchronisation :

```typescript
// Vérifier le statut
GET /api/admin/sync/status
// Réponse: {
//   firebase_connected: true,
//   pending_signalements: 5,
//   pending_users: 2,
//   needs_sync: true,
//   current_mode: "postgres"
// }

// Déclencher la synchronisation
POST /api/admin/sync/execute
// Réponse: {
//   success: true,
//   results: {
//     signalements: { synced: 5 },
//     users: { synced: 2 }
//   }
// }
```

### Interface Web Example

```html
<div class="sync-panel">
  <div class="sync-status">
    <span id="firebase-status">🔴 Hors ligne</span>
    <span id="pending-count">5 éléments en attente</span>
  </div>
  
  <button id="sync-btn" onclick="synchroniser()">
    🔄 Synchroniser
  </button>
</div>

<script>
async function synchroniser() {
  try {
    const response = await fetch('/api/admin/sync/execute', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(`Synchronisation réussie! 
        Signalements: ${result.results.signalements.synced}
        Utilisateurs: ${result.results.users.synced}`);
      
      // Rafraîchir le statut
      await verifierStatut();
    }
  } catch (error) {
    alert('Erreur de synchronisation: ' + error.message);
  }
}
</script>
```

---

## 🔧 API Endpoints

### Synchronisation

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/admin/sync/status` | GET | Statut de synchronisation |
| `/api/admin/sync/execute` | POST | Déclencher la synchronisation |
| `/api/firebase/sync/signalements` | POST | Sync signalements uniquement |
| `/api/firebase/sync/users` | POST | Sync utilisateurs uniquement |
| `/api/firebase/status` | GET | Statut de connexion Firebase |

### Headers de Réponse

Chaque requête inclut des headers informatifs :

```http
X-Data-Source: firebase | postgres
X-Firebase-Status: connected | offline | error
X-Fallback-Used: true | false
X-Sync-Mode: true | false
```

---

## 📊 Monitoring et Logs

### Table SyncLog

Toutes les synchronisations sont tracées dans la table `SyncLog` :

```sql
SELECT * FROM SyncLog 
WHERE sync_date > NOW() - INTERVAL '1 day'
ORDER BY sync_date DESC;
```

### Vues de Monitoring

```sql
-- Statut général de synchronisation
SELECT * FROM v_sync_status;

-- Signalements non synchronisés
SELECT * FROM v_signalements_non_synchronises;

-- Utilisateurs non synchronisés  
SELECT * FROM v_users_non_synchronises;

-- Statistiques des 7 derniers jours
SELECT * FROM get_sync_statistics(7);
```

### Nettoyage des Logs

```sql
-- Nettoyer les logs de plus de 30 jours
SELECT clean_old_sync_logs();
```

---

## 🛠️ Utilisation dans le Code

### Service Hybride

```typescript
import { hybridDataService } from '../services/hybridDataService';

// Vérifier le mode actuel
const isOnline = hybridDataService.isFirebaseAvailable();
console.log(`Mode: ${isOnline ? 'Firebase' : 'PostgreSQL'}`);

// Créer un signalement (automatiquement routé)
const signalement = await hybridDataService.createSignalement({
  location: { latitude: -18.8792, longitude: 47.5079 },
  user_id: userId,
  status_id: 1
});

// Récupérer des signalements
const result = await hybridDataService.getSignalements();
console.log(`Source: ${result.source}, Count: ${result.data.length}`);
```

### Middlewares de Connexion

```typescript
import { connectionMiddleware, requireFirebase, requirePostgres } from '../middleware/connection';

// Détection automatique
router.get('/signalements', connectionMiddleware, handler);

// Forcer Firebase (avec fallback)
router.get('/realtime', requireFirebase, handler);

// Forcer PostgreSQL
router.get('/reports', requirePostgres, handler);
```

---

## 🚨 Gestion des Erreurs

### Détection de Perte de Connexion

```typescript
// Le service vérifie la connexion toutes les 30 secondes
// En cas de perte, bascule automatiquement vers PostgreSQL

console.log('🔴 Connexion Firebase perdue, basculement vers PostgreSQL');
```

### Gestion des Conflits

Lors de la synchronisation, les données PostgreSQL sont **maîtres** et écrasent Firebase.

### Retry Logic

```typescript
// Configuration dans .env
AUTO_RECONNECT_ATTEMPTS=3
RECONNECT_DELAY=5000
AUTO_SYNC_ON_RECONNECT=true
```

---

## 📱 Intégration Mobile

### Headers de Statut

L'application mobile peut vérifier le mode via les headers :

```javascript
const response = await fetch('/api/signalements');
const dataSource = response.headers.get('X-Data-Source');
const firebaseStatus = response.headers.get('X-Firebase-Status');

if (dataSource === 'postgres') {
  showOfflineIndicator();
}
```

### Synchronisation Automatique

```javascript
// Détecter le retour de connexion
window.addEventListener('online', async () => {
  console.log('Connexion rétablie, vérification de Firebase...');
  
  const status = await fetch('/api/firebase/status');
  const { connected } = await status.json();
  
  if (connected) {
    console.log('Firebase disponible, synchronisation...');
    await fetch('/api/admin/sync/execute', { method: 'POST' });
  }
});
```

---

## 🔧 Scripts Utiles

### Vérifier le statut de synchronisation

```bash
# Via curl
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/admin/sync/status

# Via psql
psql -U postgres -d travaux_routiers -c "SELECT * FROM v_sync_status;"
```

### Forcer une synchronisation

```bash
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:3000/api/admin/sync/execute
```

### Simuler une panne Firebase (pour tests)

```env
# Dans .env
SIMULATE_OFFLINE=true
```

---

## 🎯 Bonnes Pratiques

1. **Monitoring** : Surveillez régulièrement la table `SyncLog`
2. **Backup** : Sauvegardez PostgreSQL quotidiennement
3. **Performance** : Limitez les batch de synchronisation (SYNC_BATCH_SIZE)
4. **Sécurité** : Ne jamais exposer les clés Firebase côté client
5. **UX** : Informez l'utilisateur du mode actuel (en ligne/hors ligne)

---

## 🐛 Dépannage

### Firebase ne se connecte pas

```bash
# Vérifier les variables d'environnement
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL

# Tester la connexion
curl http://localhost:3000/api/firebase/status
```

### Synchronisation bloquée

```sql
-- Vérifier les signalements non synchronisés
SELECT COUNT(*) FROM Signalement WHERE est_synchronise = FALSE;

-- Forcer le marquage comme synchronisé (en dernier recours)
UPDATE Signalement SET est_synchronise = TRUE WHERE firebase_id IS NOT NULL;
```

### Logs de débogage

```env
LOG_LEVEL=debug
ENABLE_SYNC_LOGGING=true
DEBUG_MODE=true
```

---

## 📚 Documentation Technique

- [Architecture Complète](./ARCHITECTURE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Schéma de Base de Données](../database/script.sql)
- [Tests d'Intégration](./tests/api.http)

---

🔄 **La synchronisation hybride garantit que votre application fonctionne toujours, connectée ou non !**
# 📋 Format des Collections Firebase

## 1. Collection : `signalements`

```json
{
  "documentId": "firebase_id_ou_auto",
  "location": {
    "latitude": -18.8792,
    "longitude": 47.5079
  },
  "description": "Route dégradée à Antananarivo",
  "user_id": 1,
  "status_id": 1,
  "date_signalement": "2026-02-03T10:30:00Z",
  "postgres_id": 8,
  "updated_at": "2026-02-03T10:32:15Z",
  "sync_version": 1
}
```

### Champs :
- `location` : GeoPoint (latitude, longitude)
- `description` : String (500 caractères max)
- `user_id` : Number (référence User_)
- `status_id` : Number (référence Status)
- `date_signalement` : Timestamp
- `postgres_id` : Number (ID PostgreSQL)
- `updated_at` : Timestamp (pour résoudre les conflits)
- `sync_version` : Number (numéro de version)

---

## 2. Collection : `reparations`

```json
{
  "documentId": "7",
  "surface_m2": 250.5,
  "budget": 5000000,
  "date_debut": "2026-02-05",
  "date_fin_prevue": "2026-03-05",
  "date_fin_reelle": null,
  "commentaire": "Repavage complet",
  "id_signalement": 8,
  "id_entreprise": 1,
  "id_status": 2,
  "id_user": 1,
  "postgres_id": 7,
  "updated_at": "2026-02-03T11:00:00Z",
  "sync_version": 1
}
```

### Champs :
- `surface_m2` : Number (surface à réparer)
- `budget` : Number (en Ariary)
- `date_debut` : Date (format YYYY-MM-DD)
- `date_fin_prevue` : Date (prévue)
- `date_fin_reelle` : Date (réelle) ou null
- `commentaire` : String
- `id_signalement` : Number (FK)
- `id_entreprise` : Number (FK)
- `id_status` : Number (FK)
- `id_user` : Number (Manager assigné)
- `postgres_id` : Number (ID PostgreSQL)

---

## 3. Collection : `entreprises`

```json
{
  "documentId": "1",
  "nom": "Entreprise Municipal",
  "telephone": "+261 20 22 123 45",
  "email": "municipal@antananarivo.mg",
  "adresse": "Antananarivo, Madagascar",
  "postgres_id": 1,
  "updated_at": "2026-02-03T10:00:00Z",
  "sync_version": 1
}
```

### Champs :
- `nom` : String
- `telephone` : String
- `email` : String
- `adresse` : String
- `postgres_id` : Number

---

## 4. Collection : `status`

```json
{
  "documentId": "1",
  "id": 1,
  "libelle": "Nouveau",
  "couleur": "#FF0000",
  "est_synchronise": true,
  "updated_at": "2026-02-03T10:00:00Z",
  "sync_version": 1
}
```

### Champs :
- `id` : Number
- `libelle` : String (Nouveau, En cours, Terminé)
- `couleur` : String (HEX color)
- `est_synchronise` : Boolean
- `updated_at` : Timestamp

---

## 5. Collection : `users`

```json
{
  "documentId": "firebase_uid",
  "id_user": 1,
  "firebase_uid": "w1iEk6R25cWPQPUF8W23giXbu2E3",
  "email": "rachriss@example.com",
  "display_name": "RaChriss",
  "id_type_user": 3,
  "est_bloque": false,
  "date_creation": "2025-01-15T08:00:00Z",
  "derniere_sync": "2026-02-03T10:32:15Z"
}
```

### Champs :
- `id_user` : Number
- `firebase_uid` : String (UID Firebase Auth)
- `email` : String
- `display_name` : String (nom complet)
- `id_type_user` : Number (1=Visiteur, 2=Utilisateur, 3=Manager)
- `est_bloque` : Boolean
- `date_creation` : Timestamp
- `derniere_sync` : Timestamp

---

## 6. Collection : `TypeUser`

```json
{
  "documentId": "1",
  "id": 1,
  "libelle": "Visiteur"
}
```

```json
{
  "documentId": "2",
  "id": 2,
  "libelle": "Utilisateur"
}
```

```json
{
  "documentId": "3",
  "id": 3,
  "libelle": "Manager"
}
```

---

## 7. Collection : `parametres`

```json
{
  "documentId": "1",
  "id_parametre": 1,
  "nom": "max_tentatives_connexion",
  "valeur": "5",
  "type": "number",
  "description": "Nombre maximum de tentatives de connexion avant blocage",
  "date_modification": "2026-02-03T10:00:00Z"
}
```

```json
{
  "documentId": "5",
  "id_parametre": 5,
  "nom": "maintenance_mode",
  "valeur": "false",
  "type": "boolean",
  "description": "Mode maintenance activé",
  "date_modification": "2026-02-03T10:00:00Z"
}
```

---

## 8. Collection : `sessions`

```json
{
  "documentId": "123",
  "id_session": 123,
  "id_user": 1,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "date_creation": "2026-02-03T10:00:00Z",
  "date_expiration": "2026-02-04T10:00:00Z",
  "est_active": true,
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0..."
}
```

---

## 9. Collection : `tentatives_connexion`

```json
{
  "documentId": "456",
  "id_tentative": 456,
  "email": "user@example.com",
  "ip_address": "192.168.1.100",
  "succes": false,
  "date_tentative": "2026-02-03T10:05:30Z",
  "raison_echec": "Mot de passe incorrect"
}
```

---

## 10. Collection : `historique_status`

```json
{
  "documentId": "1",
  "id_historique": 1,
  "id_reparation": 7,
  "status_ancien": {
    "id": 1,
    "libelle": "Nouveau"
  },
  "status_nouveau": {
    "id": 2,
    "libelle": "En cours"
  },
  "user": {
    "id": 1,
    "display_name": "RaChriss"
  },
  "date_modification": "2026-02-03T11:15:00Z",
  "commentaire": "Travaux commencés"
}
```

---

## 📊 Résumé des types de données

| Type | Exemple | Firebase |
|------|---------|----------|
| **String** | "texte" | String |
| **Number** | 123, 45.67 | Number |
| **Date** | "2026-02-03" | String (format ISO) |
| **Timestamp** | "2026-02-03T10:00:00Z" | Timestamp (auto) |
| **Boolean** | true/false | Boolean |
| **GeoPoint** | {lat, lng} | GeoPoint |
| **Object** | {id, name} | Map |
| **Array** | [] | Array |
| **null** | null | null |

---

## 🔄 Champs de synchronisation (toutes les collections)

Chaque document **synchronisé** contient :

```json
{
  "updated_at": "Timestamp Firebase",      // Pour détecter les conflits
  "sync_version": 1,                       // Numéro de version
  "postgres_id": 123                       // ID original PostgreSQL
}
```

✅ **C'est le format exact utilisé par votre système de synchronisation bidirectionnelle !**

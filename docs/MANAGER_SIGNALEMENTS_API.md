# API Gestion Complète des Signalements - Manager

> Toutes les routes nécessitent une authentification JWT et le rôle **Manager**.

## Headers requis

```http
Authorization: Bearer <token_jwt>
Content-Type: application/json
```

---

## 1. Assigner une entreprise à un signalement

**Endpoint:** `PUT /api/signalements/manager/:id/assigner-entreprise`

### Request Body

```json
{
  "id_entreprise": 1
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `id_entreprise` | integer | ✅ | ID de l'entreprise à assigner |

### Response (200 - Succès)

```json
{
  "success": true,
  "message": "Entreprise assignée avec succès",
  "entreprise": {
    "id_entreprise": 1,
    "nom": "Entreprise Municipal",
    "telephone": "+261 34 00 000 00",
    "email": "contact@municipal.mg",
    "adresse": "Antananarivo"
  }
}
```

### Erreurs possibles

| Code | Description |
|------|-------------|
| 400 | Données invalides |
| 404 | Signalement ou entreprise non trouvé |
| 401 | Non authentifié |
| 403 | Non autorisé (pas Manager) |

---

## 2. Définir le budget d'un signalement

**Endpoint:** `PUT /api/signalements/manager/:id/budget`

### Request Body

```json
{
  "budget": 1500000
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `budget` | number | ✅ | Budget en Ariary (≥ 0) |

### Response (200 - Succès)

```json
{
  "success": true,
  "message": "Budget mis à jour avec succès",
  "budget": 1500000,
  "reparation": {
    "id_reparation": 1,
    "surface_m2": "0.00",
    "budget": "1500000.00",
    "id_entreprise": 1,
    "id_signalement": 1,
    "id_status": 2
  }
}
```

---

## 3. Définir la surface d'un signalement

**Endpoint:** `PUT /api/signalements/manager/:id/surface`

### Request Body

```json
{
  "surface_m2": 25.5
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `surface_m2` | number | ✅ | Surface en m² (≥ 0) |

### Response (200 - Succès)

```json
{
  "success": true,
  "message": "Surface mise à jour avec succès",
  "surface_m2": "25.50",
  "reparation": {
    "id_reparation": 1,
    "surface_m2": "25.50",
    "budget": "0.00",
    "id_entreprise": 1,
    "id_signalement": 1,
    "id_status": 2
  }
}
```

---

## 4. Gestion complète (tout en un)

**Endpoint:** `PUT /api/signalements/manager/:id/gestion-complete`

### Request Body

```json
{
  "id_entreprise": 2,
  "budget": 2500000,
  "surface_m2": 50.75,
  "date_debut": "2026-02-01",
  "date_fin_prevue": "2026-03-15",
  "commentaire": "Travaux urgents à réaliser"
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `id_entreprise` | integer | ❌ | ID de l'entreprise |
| `budget` | number | ❌ | Budget en Ariary |
| `surface_m2` | number | ❌ | Surface en m² |
| `date_debut` | string (ISO 8601) | ❌ | Date de début des travaux |
| `date_fin_prevue` | string (ISO 8601) | ❌ | Date de fin prévue |
| `commentaire` | string | ❌ | Commentaire du manager |

### Response (200 - Succès)

```json
{
  "success": true,
  "message": "Signalement mis à jour avec succès",
  "reparation": {
    "id_reparation": 1,
    "surface_m2": "50.75",
    "budget": "2500000.00",
    "date_debut": "2026-02-01",
    "date_fin_prevue": "2026-03-15",
    "commentaire": "Travaux urgents à réaliser",
    "id_entreprise": 2,
    "id_signalement": 1,
    "id_status": 2,
    "entreprise": {
      "id_entreprise": 2,
      "nom": "Entreprise ABC",
      "telephone": "+261 34 11 111 11",
      "email": "contact@abc.mg",
      "adresse": "Antsirabe"
    }
  }
}
```

---

## 5. Modifier un signalement (accès Manager)

**Endpoint:** `PUT /api/signalements/manager/:id/modifier`

> Le manager peut modifier n'importe quel signalement, même s'il n'en est pas le créateur.

### Request Body

```json
{
  "description": "Description modifiée par le manager",
  "latitude": -18.8792,
  "longitude": 47.5079
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `description` | string | ❌ | Nouvelle description (max 500 caractères) |
| `latitude` | number | ❌ | Latitude (-90 à 90) |
| `longitude` | number | ❌ | Longitude (-180 à 180) |

### Response (200 - Succès)

```json
{
  "success": true,
  "message": "Signalement modifié par le manager",
  "signalement": {
    "id_signalement": 1,
    "longitude": 47.5079,
    "latitude": -18.8792,
    "description": "Description modifiée par le manager",
    "date_signalement": "2026-01-25T10:00:00.000Z",
    "firebase_id": "abc123",
    "est_synchronise": false,
    "id_user": 5,
    "id_status": 2
  }
}
```

---

## 6. Supprimer un signalement (accès Manager)

**Endpoint:** `DELETE /api/signalements/manager/:id/supprimer`

> Le manager peut supprimer n'importe quel signalement, quel que soit son statut.
> Supprime également la réparation et l'historique associés.

### Request Body

Aucun

### Response (200 - Succès)

```json
{
  "success": true,
  "message": "Signalement supprimé par le manager"
}
```

---

## 7. Créer une entreprise

**Endpoint:** `POST /api/signalements/manager/entreprises`

### Request Body

```json
{
  "nom": "Nouvelle Entreprise",
  "telephone": "+261 34 22 222 22",
  "email": "contact@nouvelle.mg",
  "adresse": "Toamasina, Madagascar"
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `nom` | string | ✅ | Nom de l'entreprise (max 100 caractères) |
| `telephone` | string | ❌ | Numéro de téléphone (max 20 caractères) |
| `email` | string | ❌ | Email valide |
| `adresse` | string | ❌ | Adresse complète |

### Response (201 - Créé)

```json
{
  "success": true,
  "message": "Entreprise créée avec succès",
  "entreprise": {
    "id_entreprise": 3,
    "nom": "Nouvelle Entreprise",
    "telephone": "+261 34 22 222 22",
    "email": "contact@nouvelle.mg",
    "adresse": "Toamasina, Madagascar"
  }
}
```

---

## 8. Modifier une entreprise

**Endpoint:** `PUT /api/signalements/manager/entreprises/:id`

### Request Body

```json
{
  "nom": "Nom modifié",
  "telephone": "+261 34 33 333 33",
  "email": "nouveau@email.mg",
  "adresse": "Nouvelle adresse"
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `nom` | string | ❌ | Nom de l'entreprise |
| `telephone` | string | ❌ | Numéro de téléphone |
| `email` | string | ❌ | Email valide |
| `adresse` | string | ❌ | Adresse complète |

### Response (200 - Succès)

```json
{
  "success": true,
  "message": "Entreprise modifiée avec succès",
  "entreprise": {
    "id_entreprise": 3,
    "nom": "Nom modifié",
    "telephone": "+261 34 33 333 33",
    "email": "nouveau@email.mg",
    "adresse": "Nouvelle adresse"
  }
}
```

---

## 9. Supprimer une entreprise

**Endpoint:** `DELETE /api/signalements/manager/entreprises/:id`

> ⚠️ Une entreprise ne peut être supprimée que si elle n'est assignée à aucune réparation.

### Request Body

Aucun

### Response (200 - Succès)

```json
{
  "success": true,
  "message": "Entreprise supprimée avec succès"
}
```

### Erreurs possibles

| Code | Description |
|------|-------------|
| 400 | Entreprise utilisée dans des réparations |
| 404 | Entreprise non trouvée |

---

## Codes d'erreur communs

| Code HTTP | Description |
|-----------|-------------|
| 200 | Succès |
| 201 | Ressource créée |
| 400 | Données invalides / Requête incorrecte |
| 401 | Non authentifié (token manquant ou invalide) |
| 403 | Non autorisé (rôle Manager requis) |
| 404 | Ressource non trouvée |
| 500 | Erreur serveur |

---

## Exemple d'utilisation avec cURL

### Gestion complète d'un signalement

```bash
curl -X PUT http://localhost:3000/api/signalements/manager/1/gestion-complete \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "id_entreprise": 2,
    "budget": 2500000,
    "surface_m2": 50.75,
    "date_debut": "2026-02-01",
    "date_fin_prevue": "2026-03-15",
    "commentaire": "Travaux urgents"
  }'
```

### Créer une entreprise

```bash
curl -X POST http://localhost:3000/api/signalements/manager/entreprises \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Entreprise XYZ",
    "telephone": "+261 34 00 000 00",
    "email": "contact@xyz.mg"
  }'
```

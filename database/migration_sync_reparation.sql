-- Active: 1767941341411@@127.0.0.1@5432@travaux_routiers@public
-- ============================================
-- MIGRATION: Support complet de synchronisation bidirectionnelle
-- ============================================

-- ============================================
-- TABLE SIGNALEMENT
-- ============================================

-- Ajouter derniere_sync pour tracker la dernière synchronisation
ALTER TABLE Signalement
ADD COLUMN IF NOT EXISTS derniere_sync TIMESTAMP;

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_signalement_sync ON Signalement (est_synchronise);

CREATE INDEX IF NOT EXISTS idx_signalement_derniere_sync ON Signalement (derniere_sync);

-- ============================================
-- TABLE REPARATION
-- ============================================

-- Ajouter le flag est_synchronise à la table Reparation
ALTER TABLE Reparation
ADD COLUMN IF NOT EXISTS est_synchronise BOOLEAN DEFAULT FALSE;

-- Ajouter firebase_id pour tracker les réparations dans Firebase
ALTER TABLE Reparation
ADD COLUMN IF NOT EXISTS firebase_id VARCHAR(128);

-- Ajouter derniere_sync pour tracker la dernière synchronisation
ALTER TABLE Reparation
ADD COLUMN IF NOT EXISTS derniere_sync TIMESTAMP;

-- Mettre à jour les réparations existantes (marquer comme non synchronisées)
UPDATE Reparation
SET
    est_synchronise = FALSE
WHERE
    est_synchronise IS NULL;

-- Index pour améliorer les performances des requêtes de synchronisation
CREATE INDEX IF NOT EXISTS idx_reparation_sync ON Reparation (est_synchronise);

CREATE INDEX IF NOT EXISTS idx_reparation_firebase_id ON Reparation (firebase_id);

CREATE INDEX IF NOT EXISTS idx_reparation_derniere_sync ON Reparation (derniere_sync);

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON COLUMN Signalement.derniere_sync IS 'Date de la dernière synchronisation avec Firebase';

COMMENT ON COLUMN Reparation.est_synchronise IS 'Indique si la réparation est synchronisée avec Firebase';

COMMENT ON COLUMN Reparation.firebase_id IS 'ID du document Firebase correspondant';

COMMENT ON COLUMN Reparation.derniere_sync IS 'Date de la dernière synchronisation avec Firebase';
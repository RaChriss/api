-- Active: 1768372624470@@localhost@5433@travaux_routiers@public
-- Migration: Ajout des colonnes de synchronisation Firebase
-- Date: $(date)
-- Description: Ajoute les colonnes nécessaires pour la synchronisation Firebase/PostgreSQL

BEGIN;

-- Ajouter firebase_id et est_synchronise à la table Signalement si elles n'existent pas
DO $$ 
BEGIN
    -- Vérifier et ajouter firebase_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'signalement' AND column_name = 'firebase_id') THEN
        ALTER TABLE Signalement ADD COLUMN firebase_id VARCHAR(128);
        RAISE NOTICE 'Colonne firebase_id ajoutée à la table Signalement';
    ELSE
        RAISE NOTICE 'Colonne firebase_id existe déjà dans la table Signalement';
    END IF;

    -- Vérifier et ajouter est_synchronise
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'signalement' AND column_name = 'est_synchronise') THEN
        ALTER TABLE Signalement ADD COLUMN est_synchronise BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Colonne est_synchronise ajoutée à la table Signalement';
    ELSE
        RAISE NOTICE 'Colonne est_synchronise existe déjà dans la table Signalement';
    END IF;
END $$;

-- Ajouter firebase_uid à la table User_ si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_' AND column_name = 'firebase_uid') THEN
        ALTER TABLE User_ ADD COLUMN firebase_uid VARCHAR(128);
        RAISE NOTICE 'Colonne firebase_uid ajoutée à la table User_';
    ELSE
        RAISE NOTICE 'Colonne firebase_uid existe déjà dans la table User_';
    END IF;
END $$;

-- Ajouter des index pour optimiser les requêtes de synchronisation
DO $$ 
BEGIN
    -- Index pour firebase_id
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_signalement_firebase_id') THEN
        CREATE INDEX idx_signalement_firebase_id ON Signalement(firebase_id);
        RAISE NOTICE 'Index idx_signalement_firebase_id créé';
    END IF;

    -- Index pour est_synchronise
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_signalement_est_synchronise') THEN
        CREATE INDEX idx_signalement_est_synchronise ON Signalement(est_synchronise);
        RAISE NOTICE 'Index idx_signalement_est_synchronise créé';
    END IF;

    -- Index pour firebase_uid
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_firebase_uid') THEN
        CREATE INDEX idx_user_firebase_uid ON User_(firebase_uid);
        RAISE NOTICE 'Index idx_user_firebase_uid créé';
    END IF;
END $$;

-- Table de log de synchronisation pour tracer les opérations
CREATE TABLE IF NOT EXISTS SyncLog (
    Id_SyncLog SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,        -- 'Signalement' ou 'User_'
    record_id INTEGER NOT NULL,             -- ID de l'enregistrement synchronisé
    firebase_id VARCHAR(128),               -- ID Firebase correspondant
    operation VARCHAR(20) NOT NULL,         -- 'CREATE', 'UPDATE', 'DELETE'
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',  -- 'SUCCESS', 'FAILED', 'PARTIAL'
    error_message TEXT,                     -- Message d'erreur si échec
    sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sync_duration_ms INTEGER,               -- Durée en millisecondes
    data_size INTEGER,                      -- Taille des données en bytes
    user_agent VARCHAR(255)                 -- User agent pour traçabilité
);

-- Index pour la table SyncLog
CREATE INDEX IF NOT EXISTS idx_synclog_date ON SyncLog(sync_date);
CREATE INDEX IF NOT EXISTS idx_synclog_table_record ON SyncLog(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_synclog_status ON SyncLog(status);

-- Vue pour les signalements non synchronisés avec détails
CREATE OR REPLACE VIEW v_signalements_non_synchronises AS
SELECT 
    s.id_signalement,
    s.date_signalement,
    s.longitude,
    s.latitude,
    s.firebase_id,
    s.est_synchronise,
    u.id_user,
    u.nom,
    u.prenom,
    u.email,
    u.firebase_uid,
    st.id_status,
    st.libelle as status_libelle,
    st.couleur as status_couleur
FROM Signalement s
JOIN User_ u ON s.id_user = u.id_user
JOIN Status st ON s.id_status = st.id_status
WHERE s.est_synchronise = FALSE
ORDER BY s.date_signalement DESC;

-- Vue pour les utilisateurs non synchronisés
CREATE OR REPLACE VIEW v_users_non_synchronises AS
SELECT 
    u.id_user,
    u.nom,
    u.prenom,
    u.email,
    u.firebase_uid,
    u.date_creation,
    u.est_bloque,
    t.id_type_user,
    t.libelle as type_libelle
FROM User_ u
JOIN TypeUser t ON u.id_type_user = t.id_type_user
WHERE u.firebase_uid IS NULL
ORDER BY u.date_creation DESC;

-- Vue récapitulatif synchronisation
CREATE OR REPLACE VIEW v_sync_status AS
SELECT 
    'Signalements' as type_donnee,
    COUNT(*) as total,
    COUNT(CASE WHEN est_synchronise = TRUE THEN 1 END) as synchronises,
    COUNT(CASE WHEN est_synchronise = FALSE THEN 1 END) as en_attente,
    ROUND(
        (COUNT(CASE WHEN est_synchronise = TRUE THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as pourcentage_sync
FROM Signalement
UNION ALL
SELECT 
    'Utilisateurs' as type_donnee,
    COUNT(*) as total,
    COUNT(CASE WHEN firebase_uid IS NOT NULL THEN 1 END) as synchronises,
    COUNT(CASE WHEN firebase_uid IS NULL THEN 1 END) as en_attente,
    ROUND(
        (COUNT(CASE WHEN firebase_uid IS NOT NULL THEN 1 END)::DECIMAL / NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as pourcentage_sync
FROM User_;

-- Vue pour le dashboard manager avec statistiques des travaux
CREATE OR REPLACE VIEW v_dashboard_manager AS
SELECT 
    'signalements_total' as metric,
    COUNT(*)::TEXT as value,
    'Signalements total' as label,
    'signalements' as category
FROM Signalement
UNION ALL
SELECT 
    'signalements_non_traites' as metric,
    COUNT(*)::TEXT as value,
    'Signalements non traités' as label,
    'signalements' as category
FROM Signalement s 
LEFT JOIN Reparation r ON s.id_signalement = r.id_signalement
WHERE r.id_reparation IS NULL
UNION ALL
SELECT 
    'reparations_en_cours' as metric,
    COUNT(*)::TEXT as value,
    'Réparations en cours' as label,
    'reparations' as category
FROM Reparation r
JOIN Status st ON r.id_status = st.id_status
WHERE st.libelle IN ('En cours', 'En préparation')
UNION ALL
SELECT 
    'reparations_terminees' as metric,
    COUNT(*)::TEXT as value,
    'Réparations terminées' as label,
    'reparations' as category
FROM Reparation r
JOIN Status st ON r.id_status = st.id_status
WHERE st.libelle = 'Terminé'
UNION ALL
SELECT 
    'budget_total' as metric,
    COALESCE(SUM(budget), 0)::TEXT as value,
    'Budget total (Ar)' as label,
    'budget' as category
FROM Reparation
UNION ALL
SELECT 
    'surface_totale' as metric,
    COALESCE(SUM(surface_m2), 0)::TEXT as value,
    'Surface totale (m²)' as label,
    'surface' as category
FROM Reparation
UNION ALL
SELECT 
    'entreprises_actives' as metric,
    COUNT(DISTINCT r.id_entreprise)::TEXT as value,
    'Entreprises actives' as label,
    'entreprises' as category
FROM Reparation r
WHERE r.date_fin_reelle IS NULL;

-- Vue détaillée des signalements avec informations complètes
CREATE OR REPLACE VIEW v_signalements_details AS
SELECT 
    s.id_signalement,
    s.description,
    s.date_signalement,
    s.longitude,
    s.latitude,
    s.photo_url,
    s.firebase_id,
    s.est_synchronise,
    
    -- Informations utilisateur
    u.id_user,
    u.nom as user_nom,
    u.prenom as user_prenom,
    u.email as user_email,
    tu.libelle as user_type,
    
    -- Informations statut
    st.id_status,
    st.libelle as status,
    st.couleur as status_couleur,
    
    -- Informations réparation (si existe)
    r.id_reparation,
    r.surface_m2,
    r.budget,
    r.date_debut,
    r.date_fin_prevue,
    r.date_fin_reelle,
    r.commentaire as reparation_commentaire,
    
    -- Informations entreprise (si réparation existe)
    e.id_entreprise,
    e.nom as entreprise_nom,
    e.telephone as entreprise_tel,
    e.email as entreprise_email,
    
    -- Manager assigné (si réparation existe)
    um.nom as manager_nom,
    um.prenom as manager_prenom,
    um.email as manager_email
    
FROM Signalement s
JOIN User_ u ON s.id_user = u.id_user
JOIN TypeUser tu ON u.id_type_user = tu.id_type_user
JOIN Status st ON s.id_status = st.id_status
LEFT JOIN Reparation r ON s.id_signalement = r.id_signalement
LEFT JOIN Entreprise e ON r.id_entreprise = e.id_entreprise
LEFT JOIN User_ um ON r.id_user = um.id_user
ORDER BY s.date_signalement DESC;

-- Fonction pour nettoyer les anciens logs de synchronisation (garder 30 jours)
CREATE OR REPLACE FUNCTION clean_old_sync_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM SyncLog 
    WHERE sync_date < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir des statistiques de synchronisation
CREATE OR REPLACE FUNCTION get_sync_statistics(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
    total_syncs INTEGER,
    successful_syncs INTEGER,
    failed_syncs INTEGER,
    success_rate DECIMAL,
    avg_duration_ms DECIMAL,
    total_data_mb DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_syncs,
        COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END)::INTEGER as successful_syncs,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::INTEGER as failed_syncs,
        ROUND(
            (COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END)::DECIMAL / COUNT(*)) * 100, 
            2
        ) as success_rate,
        ROUND(AVG(sync_duration_ms), 2) as avg_duration_ms,
        ROUND(SUM(data_size)::DECIMAL / (1024 * 1024), 3) as total_data_mb
    FROM SyncLog 
    WHERE sync_date >= NOW() - (days_back || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Afficher le statut final
SELECT 'Migration terminée avec succès!' as message;
SELECT * FROM v_sync_status;
-- Active: 1767941341411@@127.0.0.1@5432@travaux_routiers@public
-- ============================================
-- MIGRATION: Passage à l'authentification Firebase
-- Date: 2026-01-20
-- Description: Simplifie la table User_ pour utiliser Firebase Auth
--              GARDE le mot de passe pour connexion hors ligne
-- ============================================

BEGIN;

-- =============================================
-- 1. TABLE PARAMETRE (Paramètres globaux)
-- =============================================

-- Recréer la table Parametre avec structure: nom, valeur, type
DROP TABLE IF EXISTS Parametre CASCADE;

CREATE TABLE Parametre (
    Id_parametre SERIAL PRIMARY KEY,
    nom VARCHAR(100) UNIQUE NOT NULL, -- Nom du paramètre
    valeur VARCHAR(255) NOT NULL, -- Valeur du paramètre
    type VARCHAR(50) NOT NULL DEFAULT 'string', -- Type: string, number, boolean, json
    description VARCHAR(255), -- Description optionnelle
    date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Paramètres par défaut
INSERT INTO
    Parametre (
        nom,
        valeur,
        type,
        description
    )
VALUES (
        'max_tentatives_connexion',
        '5',
        'number',
        'Nombre max de tentatives avant blocage'
    ),
    (
        'duree_blocage_minutes',
        '30',
        'number',
        'Durée de blocage en minutes après max tentatives'
    ),
    (
        'session_expiration_heures',
        '24',
        'number',
        'Durée de validité d''une session en heures'
    ),
    (
        'refresh_token_jours',
        '7',
        'number',
        'Durée de validité du refresh token en jours'
    ),
    (
        'activer_blocage_auto',
        'true',
        'boolean',
        'Activer le blocage automatique après échecs'
    ),
    (
        'sync_interval_minutes',
        '5',
        'number',
        'Intervalle de synchronisation Firebase en minutes'
    )
ON CONFLICT (nom) DO
UPDATE
SET
    valeur = EXCLUDED.valeur,
    date_modification = CURRENT_TIMESTAMP;

-- =============================================
-- 2. TABLE SESSION (Gestion des sessions)
-- =============================================

DROP TABLE IF EXISTS Session CASCADE;

CREATE TABLE Session (
    Id_session SERIAL PRIMARY KEY,
    Id_user INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE, -- Token de session (firebase_uid ou local_xxx)
    refresh_token VARCHAR(500), -- Token de rafraîchissement
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_expiration TIMESTAMP NOT NULL,
    est_active BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(45), -- IPv4 ou IPv6
    user_agent VARCHAR(500), -- Navigateur/appareil
    FOREIGN KEY (Id_user) REFERENCES User_ (Id_user) ON DELETE CASCADE
);

CREATE INDEX idx_session_token ON Session (token);

CREATE INDEX idx_session_user ON Session (Id_user);

CREATE INDEX idx_session_expiration ON Session (date_expiration);

-- =============================================
-- 3. TABLE TENTATIVE CONNEXION (Sécurité)
-- =============================================

DROP TABLE IF EXISTS TentativeConnexion CASCADE;

CREATE TABLE TentativeConnexion (
    Id_tentative SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL, -- Email tenté (pas forcément existant)
    ip_address VARCHAR(45), -- IP de la tentative
    succes BOOLEAN DEFAULT FALSE, -- Tentative réussie ou non
    date_tentative TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raison_echec VARCHAR(100) -- 'invalid_password', 'user_not_found', 'blocked', etc.
);

CREATE INDEX idx_tentative_email ON TentativeConnexion (email);

CREATE INDEX idx_tentative_date ON TentativeConnexion (date_tentative);

CREATE INDEX idx_tentative_ip ON TentativeConnexion (ip_address);

-- =============================================
-- 4. NOUVELLE STRUCTURE DE LA TABLE User_
-- =============================================

-- Créer une nouvelle table User_ simplifiée (backup de l'ancienne d'abord)
CREATE TABLE IF NOT EXISTS User_backup AS SELECT * FROM User_;

-- Supprimer l'ancienne table User_
DROP TABLE IF EXISTS User_ CASCADE;

-- Nouvelle table User_ avec mot de passe pour mode hors ligne
CREATE TABLE User_ (
    Id_user SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(128) UNIQUE, -- UID Firebase Auth (peut être NULL si créé hors ligne)
    email VARCHAR(100) UNIQUE NOT NULL, -- Email pour référence
    password VARCHAR(255) NOT NULL, -- Mot de passe en CLAIR pour connexion hors ligne
    display_name VARCHAR(100), -- Nom affiché
    Id_type_user INT NOT NULL DEFAULT 2, -- Type utilisateur (1=Visiteur, 2=Utilisateur, 3=Manager)
    est_bloque BOOLEAN DEFAULT FALSE, -- Blocage local
    date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    derniere_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Dernière synchronisation
    FOREIGN KEY (Id_type_user) REFERENCES TypeUser (Id_type_user)
);

-- Index pour optimiser les recherches
CREATE INDEX idx_user_firebase_uid ON User_ (firebase_uid);

CREATE INDEX idx_user_email ON User_ (email);

CREATE INDEX idx_user_type ON User_ (Id_type_user);

-- =============================================
-- 2. RECRÉER LES TABLES DÉPENDANTES
-- =============================================

-- Recréer la table Signalement avec référence à la nouvelle User_
-- (Si elle existe, on la garde, sinon on la crée)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'signalement' AND column_name = 'id_user') THEN
        -- La table n'a pas id_user, la recréer
        RAISE NOTICE 'Recréation de la table Signalement...';
    END IF;
END $$;

-- =============================================
-- 3. DONNÉES PAR DÉFAUT
-- =============================================

-- S'assurer que les types d'utilisateurs existent
INSERT INTO TypeUser (Id_type_user, libelle) VALUES 
    (1, 'Visiteur'),
    (2, 'Utilisateur'),
    (3, 'Manager')
ON CONFLICT (Id_type_user) DO NOTHING;

-- =============================================
-- 4. VUES UTILES
-- =============================================

-- Vue pour les utilisateurs avec leur type
CREATE OR REPLACE VIEW v_users_with_type AS
SELECT 
    u.Id_user,
    u.firebase_uid,
    u.email,
    u.display_name,
    u.Id_type_user,
    t.libelle as type_libelle,
    u.est_bloque,
    u.date_creation,
    u.derniere_sync
FROM User_ u
JOIN TypeUser t ON u.Id_type_user = t.Id_type_user;

-- =============================================
-- 5. FONCTIONS UTILITAIRES
-- =============================================

-- Fonction pour synchroniser un utilisateur depuis Firebase
CREATE OR REPLACE FUNCTION sync_user_from_firebase(
    p_firebase_uid VARCHAR(128),
    p_email VARCHAR(100),
    p_password VARCHAR(255),
    p_display_name VARCHAR(100) DEFAULT NULL,
    p_type_user INT DEFAULT 2
) RETURNS INTEGER AS $$
DECLARE
    v_user_id INTEGER;
BEGIN
    -- Insérer ou mettre à jour l'utilisateur
    INSERT INTO User_ (firebase_uid, email, password, display_name, Id_type_user, derniere_sync)
    VALUES (p_firebase_uid, p_email, p_password, p_display_name, p_type_user, CURRENT_TIMESTAMP)
    ON CONFLICT (firebase_uid) 
    DO UPDATE SET 
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        display_name = EXCLUDED.display_name,
        derniere_sync = CURRENT_TIMESTAMP
    RETURNING Id_user INTO v_user_id;
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si un utilisateur existe localement
CREATE OR REPLACE FUNCTION user_exists_locally(p_firebase_uid VARCHAR(128)) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM User_ WHERE firebase_uid = p_firebase_uid);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. FONCTIONS POUR TENTATIVES DE CONNEXION
-- =============================================

-- Fonction pour enregistrer une tentative de connexion
CREATE OR REPLACE FUNCTION enregistrer_tentative(
    p_email VARCHAR(100),
    p_ip_address VARCHAR(45),
    p_succes BOOLEAN,
    p_raison_echec VARCHAR(100) DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO TentativeConnexion (email, ip_address, succes, raison_echec)
    VALUES (p_email, p_ip_address, p_succes, p_raison_echec);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour compter les tentatives échouées récentes
CREATE OR REPLACE FUNCTION compter_tentatives_echouees(
    p_email VARCHAR(100),
    p_minutes INT DEFAULT 30
) RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM TentativeConnexion
    WHERE email = p_email
      AND succes = FALSE
      AND date_tentative > (CURRENT_TIMESTAMP - (p_minutes || ' minutes')::INTERVAL);
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si un utilisateur doit être bloqué
CREATE OR REPLACE FUNCTION verifier_blocage(p_email VARCHAR(100)) 
RETURNS BOOLEAN AS $$
DECLARE
    v_max_tentatives INT;
    v_duree_blocage INT;
    v_tentatives INT;
BEGIN
    -- Récupérer les paramètres
    SELECT valeur::INT INTO v_max_tentatives FROM Parametre WHERE nom = 'max_tentatives_connexion';
    SELECT valeur::INT INTO v_duree_blocage FROM Parametre WHERE nom = 'duree_blocage_minutes';
    
    -- Compter les tentatives échouées
    v_tentatives := compter_tentatives_echouees(p_email, v_duree_blocage);
    
    RETURN v_tentatives >= v_max_tentatives;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 7. FONCTIONS POUR GESTION DES SESSIONS
-- =============================================

-- Fonction pour créer une session
CREATE OR REPLACE FUNCTION creer_session(
    p_user_id INT,
    p_token VARCHAR(500),
    p_ip_address VARCHAR(45) DEFAULT NULL,
    p_user_agent VARCHAR(500) DEFAULT NULL
) RETURNS INT AS $$
DECLARE
    v_session_id INT;
    v_expiration_heures INT;
BEGIN
    -- Récupérer la durée de session
    SELECT valeur::INT INTO v_expiration_heures FROM Parametre WHERE nom = 'session_expiration_heures';
    IF v_expiration_heures IS NULL THEN v_expiration_heures := 24; END IF;
    
    -- Créer la session
    INSERT INTO Session (Id_user, token, date_expiration, ip_address, user_agent)
    VALUES (p_user_id, p_token, CURRENT_TIMESTAMP + (v_expiration_heures || ' hours')::INTERVAL, p_ip_address, p_user_agent)
    RETURNING Id_session INTO v_session_id;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour valider une session
CREATE OR REPLACE FUNCTION valider_session(p_token VARCHAR(500)) 
RETURNS TABLE (
    user_id INT,
    est_valide BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.Id_user, (s.est_active AND s.date_expiration > CURRENT_TIMESTAMP)
    FROM Session s
    WHERE s.token = p_token;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour invalider toutes les sessions d'un utilisateur
CREATE OR REPLACE FUNCTION invalider_sessions_user(p_user_id INT) 
RETURNS VOID AS $$
BEGIN
    UPDATE Session SET est_active = FALSE WHERE Id_user = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Nettoyer les sessions expirées (à exécuter périodiquement)
CREATE OR REPLACE FUNCTION nettoyer_sessions_expirees() 
RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    DELETE FROM Session WHERE date_expiration < CURRENT_TIMESTAMP OR est_active = FALSE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 8. FONCTION POUR RÉCUPÉRER UN PARAMÈTRE
-- =============================================

CREATE OR REPLACE FUNCTION get_parametre(p_nom VARCHAR(100)) 
RETURNS VARCHAR(255) AS $$
DECLARE
    v_valeur VARCHAR(255);
BEGIN
    SELECT valeur INTO v_valeur FROM Parametre WHERE nom = p_nom;
    RETURN v_valeur;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_parametre(
    p_nom VARCHAR(100),
    p_valeur VARCHAR(255)
) RETURNS VOID AS $$
BEGIN
    UPDATE Parametre SET valeur = p_valeur, date_modification = CURRENT_TIMESTAMP WHERE nom = p_nom;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- =============================================
-- NOTES D'IMPLÉMENTATION
-- =============================================
--
-- Structure Firebase Firestore collection "User_":
-- {
--   firebase_uid: string,     // UID de Firebase Auth
--   email: string,            // Email de l'utilisateur
--   password: string,         // Mot de passe en CLAIR (pour sync hors ligne)
--   display_name: string,     // Nom affiché
--   type_user: number,        // 1=Visiteur, 2=Utilisateur, 3=Manager
--   est_bloque: boolean,      // Statut de blocage
--   date_creation: timestamp, // Date de création
-- }
--
-- MODES D'AUTHENTIFICATION:
--
-- 1. MODE EN LIGNE (Firebase disponible):
--    - Inscription: Firebase Auth createUser + Firestore + PostgreSQL
--    - Connexion: Firebase Auth signIn (côté client) → API vérifie ID Token
--    - Le mot de passe est synchronisé vers PostgreSQL pour usage hors ligne
--
-- 2. MODE HORS LIGNE (Firebase non disponible):
--    - Connexion: Vérification mot de passe directement dans PostgreSQL
--    - Fonctionne uniquement si l'utilisateur s'est connecté au moins une fois en ligne
--    - Le mot de passe est stocké en clair (pas de hashage)
--
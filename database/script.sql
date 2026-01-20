-- ============================================
-- SCHEMA BASE DE DONNEES COMPLET - PostgreSQL
-- Projet: Gestion des Travaux Routiers
-- ============================================

-- Table des types d'utilisateurs (Visiteur, Utilisateur, Manager)
CREATE TABLE TypeUser(
   Id_type_user SERIAL PRIMARY KEY,
   libelle VARCHAR(50) NOT NULL  -- 'Visiteur', 'Utilisateur', 'Manager'
);

-- Table des statuts des signalements
CREATE TABLE Status(
   Id_Status SERIAL PRIMARY KEY,
   libelle VARCHAR(50) NOT NULL,  -- 'Nouveau', 'En cours', 'Terminé'
   couleur VARCHAR(7)  -- Code couleur hexadécimal pour affichage carte (#FF0000)
);

-- Table des utilisateurs
CREATE TABLE User_(
   Id_user SERIAL PRIMARY KEY,
   nom VARCHAR(50) NOT NULL,
   prenom VARCHAR(50),
   email VARCHAR(100) UNIQUE NOT NULL,
   password VARCHAR(255) NOT NULL,  -- Hash du mot de passe
   firebase_uid VARCHAR(128),  -- UID Firebase pour synchronisation
   date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   est_bloque BOOLEAN DEFAULT FALSE,
   Id_type_user INT NOT NULL,
   FOREIGN KEY(Id_type_user) REFERENCES TypeUser(Id_type_user)
);

-- Table des paramètres par type d'utilisateur (sessions et sécurité)
CREATE TABLE Parametre(
   Id_parametre SERIAL PRIMARY KEY,
   nom VARCHAR(50) NOT NULL,
   limite_tentatives INT NOT NULL DEFAULT 3,  -- Nombre max de tentatives de connexion
   duree_session INT NOT NULL DEFAULT 3600,  -- Durée session en secondes (1h par défaut)
   Id_type_user INT NOT NULL UNIQUE,  -- Unique: un seul paramètre par type
   FOREIGN KEY(Id_type_user) REFERENCES TypeUser(Id_type_user)
);

-- Table des tentatives de connexion (pour le blocage)
CREATE TABLE TentativeConnexion(
   Id_tentative SERIAL PRIMARY KEY,
   Id_user INT NOT NULL,
   date_tentative TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   succes BOOLEAN DEFAULT FALSE,
   adresse_ip VARCHAR(45),  -- IPv4 ou IPv6
   FOREIGN KEY(Id_user) REFERENCES User_(Id_user)
);

-- Table des sessions actives
CREATE TABLE Session(
   Id_session SERIAL PRIMARY KEY,
   Id_user INT NOT NULL,
   token VARCHAR(255) UNIQUE NOT NULL,
   date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   date_expiration TIMESTAMP NOT NULL,
   est_active BOOLEAN DEFAULT TRUE,
   FOREIGN KEY(Id_user) REFERENCES User_(Id_user)
);

-- Table des entreprises de construction
CREATE TABLE Entreprise(
   Id_Entreprise SERIAL PRIMARY KEY,
   nom VARCHAR(100) NOT NULL,
   telephone VARCHAR(20),
   email VARCHAR(100),
   adresse TEXT
);

-- Table des signalements de problèmes routiers (créé par Utilisateur)
CREATE TABLE Signalement(
   Id_Signalement SERIAL PRIMARY KEY,
   location geopoint ,     -- photo_url VARCHAR(255),  -- URL ou chemin de la photo
   date_signalement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   firebase_id VARCHAR(128),  -- ID du document Firebase
   est_synchronise BOOLEAN DEFAULT FALSE,  -- Synchronisé avec Firebase
   Id_user INT NOT NULL,  -- Utilisateur qui a signalé
   Id_Status INT NOT NULL,  -- Statut de la réparation
   FOREIGN KEY(Id_Status) REFERENCES Status(Id_Status),
   FOREIGN KEY(Id_user) REFERENCES User_(Id_user)
);

-- Table des réparations (créé par Manager pour un Signalement)
CREATE TABLE Reparation(
   Id_Reparation SERIAL PRIMARY KEY,
   surface_m2 DECIMAL(10,2) NOT NULL,  -- Surface en m²
   budget DECIMAL(15,2) NOT NULL,  -- Budget en Ariary
   date_debut DATE,  -- Date début prévue des travaux
   date_fin_prevue DATE,  -- Date fin prévue des travaux
   date_fin_reelle DATE,  -- Date réelle de fin des travaux
   commentaire TEXT,  -- Commentaires du manager
   date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   date_modification TIMESTAMP,
   Id_Signalement INT NOT NULL,  -- Signalement concerné
   Id_Entreprise INT NOT NULL,  -- Entreprise assignée
   Id_Status INT NOT NULL,  -- Statut de la réparation
   Id_user INT NOT NULL,  -- Manager qui a créé la réparation
   FOREIGN KEY(Id_Signalement) REFERENCES Signalement(Id_Signalement),
   FOREIGN KEY(Id_Entreprise) REFERENCES Entreprise(Id_Entreprise),
   FOREIGN KEY(Id_Status) REFERENCES Status(Id_Status),
   FOREIGN KEY(Id_user) REFERENCES User_(Id_user)
);

-- Table d'historique des modifications de statut des réparations
CREATE TABLE HistoriqueStatus(
   Id_Historique SERIAL PRIMARY KEY,
   Id_Reparation INT NOT NULL,
   Id_Status_Ancien INT,
   Id_Status_Nouveau INT NOT NULL,
   Id_user INT NOT NULL,  -- Manager qui a modifié
   date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   commentaire TEXT,
   FOREIGN KEY(Id_Reparation) REFERENCES Reparation(Id_Reparation),
   FOREIGN KEY(Id_Status_Ancien) REFERENCES Status(Id_Status),
   FOREIGN KEY(Id_Status_Nouveau) REFERENCES Status(Id_Status),
   FOREIGN KEY(Id_user) REFERENCES User_(Id_user)
);

-- ============================================
-- DONNEES INITIALES
-- ============================================

-- Types d'utilisateurs
INSERT INTO TypeUser (libelle) VALUES 
   ('Visiteur'),
   ('Utilisateur'),
   ('Manager');

-- Statuts
INSERT INTO Status (libelle, couleur) VALUES 
   ('Nouveau', '#FF0000'),      -- Rouge
   ('En cours', '#FFA500'),     -- Orange
   ('Terminé', '#00FF00');      -- Vert

-- Paramètres par type d'utilisateur
INSERT INTO Parametre (nom, limite_tentatives, duree_session, Id_type_user) VALUES 
   ('Paramètres Visiteur', 3, 3600, 1),      -- 1h de session
   ('Paramètres Utilisateur', 3, 7200, 2),   -- 2h de session
   ('Paramètres Manager', 5, 14400, 3);      -- 4h de session, 5 tentatives

-- Entreprise par défaut
INSERT INTO Entreprise (nom, telephone, email, adresse) VALUES 
   ('Entreprise Municipal', '+261 20 22 123 45', 'municipal@antananarivo.mg', 'Antananarivo, Madagascar');

-- Manager par défaut (mot de passe: admin123 - hash bcrypt)
INSERT INTO User_ (nom, prenom, email, password, Id_type_user) VALUES 
   ('Admin', 'Manager', 'manager@travaux.mg', '$2b$10$N9qo8uLOickgx2ZMRZoMye5jZNvhkVOOYuC7a8h5Ggq.LJaFdW.bO', 3);

-- ============================================
-- INDEX POUR PERFORMANCES
-- ============================================

CREATE INDEX idx_user_email ON User_(email);
CREATE INDEX idx_user_firebase ON User_(firebase_uid);
CREATE INDEX idx_signalement_user ON Signalement(Id_user);
CREATE INDEX idx_signalement_firebase ON Signalement(firebase_id);
CREATE INDEX idx_reparation_signalement ON Reparation(Id_Signalement);
CREATE INDEX idx_reparation_status ON Reparation(Id_Status);
CREATE INDEX idx_reparation_entreprise ON Reparation(Id_Entreprise);
CREATE INDEX idx_session_token ON Session(token);
CREATE INDEX idx_session_user ON Session(Id_user);
CREATE INDEX idx_tentative_user ON TentativeConnexion(Id_user);

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue pour le tableau récapitulatif
CREATE VIEW v_recapitulatif AS
SELECT 
   COUNT(DISTINCT s.Id_Signalement) as nb_signalements,
   COUNT(r.Id_Reparation) as nb_reparations,
   COALESCE(SUM(r.surface_m2), 0) as surface_totale,
   COALESCE(SUM(r.budget), 0) as budget_total,
   COALESCE(ROUND(COUNT(CASE WHEN r.Id_Status = 3 THEN 1 END) * 100.0 / NULLIF(COUNT(r.Id_Reparation), 0), 2), 0) as avancement_pct
FROM Signalement s
LEFT JOIN Reparation r ON s.Id_Signalement = r.Id_Signalement;

-- Vue pour les signalements avec détails
CREATE VIEW v_signalements_details AS
SELECT 
   s.Id_Signalement,
   s.location,
   s.date_signalement,
   s.firebase_id,
   s.est_synchronise,
   u.nom as nom_utilisateur,
   u.prenom as prenom_utilisateur,
   u.email as email_utilisateur,
   st_sig.libelle as statut_signalement,
   st_sig.couleur as couleur_signalement,
   rep.Id_Reparation,
   rep.surface_m2,
   rep.budget,
   rep.date_debut,
   rep.date_fin_prevue,
   rep.date_fin_reelle,
   rep.commentaire,
   st_rep.libelle as statut_reparation,
   st_rep.couleur as couleur_reparation,
   e.nom as nom_entreprise,
   e.telephone as telephone_entreprise
FROM Signalement s
LEFT JOIN User_ u ON s.Id_user = u.Id_user
LEFT JOIN Status st_sig ON s.Id_Status = st_sig.Id_Status
LEFT JOIN Reparation rep ON s.Id_Signalement = rep.Id_Signalement
LEFT JOIN Status st_rep ON rep.Id_Status = st_rep.Id_Status
LEFT JOIN Entreprise e ON rep.Id_Entreprise = e.Id_Entreprise;

-- Vue pour les signalements sans réparation (à traiter par Manager)
CREATE VIEW v_signalements_non_traites AS
SELECT 
   s.Id_Signalement,
   s.location,
   s.date_signalement,
   s.firebase_id,
   u.nom as nom_utilisateur,
   u.prenom as prenom_utilisateur,
   u.email as email_utilisateur,
   st.libelle as statut,
   st.couleur as couleur_statut
FROM Signalement s
LEFT JOIN User_ u ON s.Id_user = u.Id_user
LEFT JOIN Status st ON s.Id_Status = st.Id_Status
LEFT JOIN Reparation rep ON s.Id_Signalement = rep.Id_Signalement
WHERE rep.Id_Reparation IS NULL;

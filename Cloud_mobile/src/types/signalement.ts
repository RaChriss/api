/**
 * Types alignés avec le schéma PostgreSQL (script.sql)
 * Table Signalement + Reparation + Status + Entreprise
 */

// Statuts selon la table Status (Nouveau, En cours, Terminé)
export type SignalementStatus = "nouveau" | "en_cours" | "termine";

// Couleurs des statuts (depuis la table Status)
export const STATUS_COLORS: Record<SignalementStatus, string> = {
  nouveau: "#FF0000",    // Rouge
  en_cours: "#FFA500",   // Orange
  termine: "#00FF00",    // Vert
};

export const STATUS_LABELS: Record<SignalementStatus, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  termine: "Terminé",
};

// Entreprise (depuis la table Entreprise)
export interface Entreprise {
  id: number;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
}

// Payload pour créer un signalement (envoyé par l'utilisateur mobile)
export interface SignalementPayload {
  latitude: number | null;
  longitude: number | null;
  status: SignalementStatus;
  userId: string | null;       // firebase_uid
  userEmail: string | null;
}

// Signalement complet avec les détails (lecture)
export interface SignalementRecord {
  id: string;                  // firebase_id
  // Location (geopoint dans PostgreSQL)
  latitude: number | null;
  longitude: number | null;
  // Dates
  dateSignalement: Date | null;
  createdAt: Date | null;
  // Statut
  status: SignalementStatus;
  statusLabel: string;
  statusCouleur: string;
  // Utilisateur
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  // Infos réparation (depuis table Reparation, remplies par Manager)
  surfaceM2: number | null;
  budget: number | null;
  dateDebut: Date | null;
  dateFinPrevue: Date | null;
  dateFinReelle: Date | null;
  commentaire: string | null;
  // Entreprise concernée (depuis table Entreprise)
  entreprise: Entreprise | null;
  entrepriseNom: string | null;
  // Synchronisation
  estSynchronise: boolean;
}

// Réponse API
export interface SignalementApiResponse {
  success: boolean;
  data?: SignalementRecord | SignalementRecord[] | { id: string };
  error?: string;
  message?: string;
}

// Tableau récapitulatif (vue v_recapitulatif dans PostgreSQL)
export interface RecapitulatifData {
  nbSignalements: number;
  nbReparations: number;
  surfaceTotale: number;
  budgetTotal: number;
  avancementPct: number;
}

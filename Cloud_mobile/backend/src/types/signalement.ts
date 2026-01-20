/**
 * Types alignés avec le schéma PostgreSQL (script.sql)
 */

export type SignalementStatus = "nouveau" | "en_cours" | "termine";

export const STATUS_COLORS: Record<SignalementStatus, string> = {
  nouveau: "#FF0000",
  en_cours: "#FFA500",
  termine: "#00FF00",
};

export const STATUS_LABELS: Record<SignalementStatus, string> = {
  nouveau: "Nouveau",
  en_cours: "En cours",
  termine: "Terminé",
};

export interface Entreprise {
  id: number;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
}

export type Signalement = {
  id: string;
  // Location (geopoint)
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
  // Réparation (rempli par Manager)
  surfaceM2: number | null;
  budget: number | null;
  dateDebut: Date | null;
  dateFinPrevue: Date | null;
  commentaire: string | null;
  // Entreprise
  entrepriseNom: string | null;
  // Sync
  estSynchronise: boolean;
};

export type SignalementPayload = {
  latitude: number | null;
  longitude: number | null;
  status: SignalementStatus;
  userId: string | null;
  userEmail: string | null;
};

export type SignalementApiResponse = {
  success: boolean;
  data?: Signalement | Signalement[] | { id: string };
  error?: string;
  message?: string;
};

export type RecapitulatifData = {
  nbSignalements: number;
  nbReparations: number;
  surfaceTotale: number;
  budgetTotal: number;
  avancementPct: number;
};

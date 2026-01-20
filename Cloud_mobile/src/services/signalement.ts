/**
 * Service de gestion des signalements - Travaux Routiers Antananarivo
 * Connecte l'application mobile à Firebase Firestore
 */
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, db } from "@/Firebase/FirebaseConfig";
import type { 
  SignalementPayload, 
  SignalementRecord, 
  RecapitulatifData,
  SignalementStatus 
} from "@/types/signalement";
import { STATUS_COLORS, STATUS_LABELS } from "@/types/signalement";

// URL de l'API backend
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Prépare le payload pour créer un signalement
 */
export const prepareSignalementPayload = (
  latitude: number,
  longitude: number
): SignalementPayload => {
  const currentUser = auth.currentUser;

  return {
    latitude,
    longitude,
    status: "nouveau",
    userId: currentUser?.uid ?? null,
    userEmail: currentUser?.email ?? null,
  };
};

/**
 * Envoie un nouveau signalement via l'API backend
 */
export const submitSignalement = async (
  payload: SignalementPayload
): Promise<string> => {
  if (!auth.currentUser) {
    throw new Error("Authentification requise.");
  }

  console.log('[Signalement] Envoi vers:', `${API_URL}/api/signalements`);

  const response = await fetch(`${API_URL}/api/signalements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur API: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.data?.id || data.id || 'unknown';
};

/**
 * Convertit un document Firestore en SignalementRecord
 */
const docToSignalement = (doc: any): SignalementRecord => {
  const data = doc.data();
  const status: SignalementStatus = data.status || "nouveau";

  return {
    id: doc.id,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    dateSignalement: data.dateSignalement?.toDate?.() ?? data.createdAt?.toDate?.() ?? null,
    createdAt: data.createdAt?.toDate?.() ?? null,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    statusCouleur: STATUS_COLORS[status] || "#999999",
    userId: data.userId ?? null,
    userEmail: data.userEmail ?? null,
    userName: data.userName ?? null,
    surfaceM2: data.surfaceM2 ?? null,
    budget: data.budget ?? null,
    dateDebut: data.dateDebut?.toDate?.() ?? null,
    dateFinPrevue: data.dateFinPrevue?.toDate?.() ?? null,
    dateFinReelle: data.dateFinReelle?.toDate?.() ?? null,
    commentaire: data.commentaire ?? null,
    entreprise: data.entreprise ?? null,
    entrepriseNom: data.entrepriseNom ?? data.entreprise?.nom ?? null,
    estSynchronise: data.estSynchronise ?? true,
  };
};

/**
 * Récupère les signalements de l'utilisateur connecté
 */
export const fetchMySignalements = async (
  userId: string
): Promise<SignalementRecord[]> => {
  const snapshot = await getDocs(
    query(
      collection(db, "signalements"),
      where("userId", "==", userId)
    )
  );

  return snapshot.docs
    .map(docToSignalement)
    .sort((a, b) => {
      const timeA = a.createdAt?.getTime() ?? 0;
      const timeB = b.createdAt?.getTime() ?? 0;
      return timeB - timeA;
    });
};

/**
 * Récupère tous les signalements (pour la carte)
 */
export const fetchAllSignalements = async (): Promise<SignalementRecord[]> => {
  const snapshot = await getDocs(collection(db, "signalements"));

  return snapshot.docs
    .map(docToSignalement)
    .sort((a, b) => {
      const timeA = a.createdAt?.getTime() ?? 0;
      const timeB = b.createdAt?.getTime() ?? 0;
      return timeB - timeA;
    });
};

/**
 * Calcule le tableau récapitulatif
 */
export const calculateRecapitulatif = (
  signalements: SignalementRecord[]
): RecapitulatifData => {
  const nbSignalements = signalements.length;
  const signalementsAvecReparation = signalements.filter(s => s.surfaceM2 !== null);
  const nbReparations = signalementsAvecReparation.length;
  
  const surfaceTotale = signalementsAvecReparation.reduce(
    (sum, s) => sum + (s.surfaceM2 ?? 0), 0
  );
  
  const budgetTotal = signalementsAvecReparation.reduce(
    (sum, s) => sum + (s.budget ?? 0), 0
  );
  
  const nbTermines = signalements.filter(s => s.status === "termine").length;
  const avancementPct = nbSignalements > 0 
    ? Math.round((nbTermines / nbSignalements) * 100) 
    : 0;

  return {
    nbSignalements,
    nbReparations,
    surfaceTotale,
    budgetTotal,
    avancementPct,
  };
};

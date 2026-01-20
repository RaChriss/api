import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "@/Firebase/FirebaseConfig";
import type { SignalementPayload, SignalementRecord } from "@/types/signalement";

export type SignalementFormInput = {
  title: string;
  description: string;
  surfaceM2: string;
  budget: string;
  latitude: string;
  longitude: string;
};

const parseNumberOrNull = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export const prepareSignalementPayload = (
  form: SignalementFormInput
): SignalementPayload => {
  const currentUser = auth.currentUser;

  return {
    title: form.title.trim(),
    description: form.description.trim(),
    surfaceM2: parseNumberOrNull(form.surfaceM2),
    budget: parseNumberOrNull(form.budget),
    latitude: parseNumberOrNull(form.latitude),
    longitude: parseNumberOrNull(form.longitude),
    status: "nouveau",
    userId: currentUser?.uid ?? null,
    userEmail: currentUser?.email ?? null,
  };
};

export const submitSignalement = async (
  payload: SignalementPayload
): Promise<string> => {
  if (!auth.currentUser) {
    throw new Error("Authentification requise.");
  }
  
  // Use the API backend instead of direct Firestore write
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  
  console.log('[Signalement] Submitting to:', `${apiUrl}/api/signalements`);
  console.log('[Signalement] Payload:', payload);
  
  try {
    const response = await fetch(`${apiUrl}/api/signalements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[Signalement] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Signalement] Response error:', errorText);
      throw new Error(`API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[Signalement] Success response:', data);
    return data.id || data.documentId || 'unknown';
  } catch (error) {
    console.error('[Signalement] Error submitting signalement via API:', error);
    throw error;
  }
};

export const fetchMySignalements = async (
  userId: string
): Promise<SignalementRecord[]> => {
  const snapshot = await getDocs(
    query(collection(db, "signalements"), where("userId", "==", userId))
  );

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as SignalementPayload & {
        createdAt?: { toDate?: () => Date };
      };

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? null,
      };
    })
    .sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.getTime() : 0;
      const timeB = b.createdAt ? b.createdAt.getTime() : 0;
      return timeB - timeA;
    });
};

export const fetchAllSignalements = async (): Promise<SignalementRecord[]> => {
  const snapshot = await getDocs(query(collection(db, "signalements")));

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as SignalementPayload & {
        createdAt?: { toDate?: () => Date };
      };

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? null,
      };
    })
    .sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.getTime() : 0;
      const timeB = b.createdAt ? b.createdAt.getTime() : 0;
      return timeB - timeA;
    });
};

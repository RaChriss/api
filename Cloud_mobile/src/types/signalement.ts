export type SignalementStatus = "nouveau" | "en_cours" | "termine";

export type SignalementPayload = {
  title: string;
  description: string;
  surfaceM2: number | null;
  budget: number | null;
  latitude: number | null;
  longitude: number | null;
  status: SignalementStatus;
  userId: string | null;
  userEmail: string | null;
};

export type SignalementRecord = SignalementPayload & {
  id: string;
  createdAt: Date | null;
};

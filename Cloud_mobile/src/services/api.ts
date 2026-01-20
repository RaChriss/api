/**
 * Service API client pour les signalements
 * Utilisé par l'app web pour récupérer les données depuis le backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

console.log('[API] Base URL:', API_BASE_URL);

export interface SignalementApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export async function fetchAllSignalementsFromApi(): Promise<any[]> {
  try {
    console.log('[API] Fetching all signalements from:', `${API_BASE_URL}/api/signalements`);
    const response = await fetch(`${API_BASE_URL}/api/signalements`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.statusText}`);
    }

    const result: SignalementApiResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de la récupération des signalements');
    }

    return result.data || [];
  } catch (error) {
    console.error('[API] Erreur lors de la récupération des signalements:', error);
    throw error;
  }
}

export async function fetchSignalementById(id: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/signalements/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.statusText}`);
    }

    const result: SignalementApiResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de la récupération du signalement');
    }

    return result.data;
  } catch (error) {
    console.error('Erreur lors de la récupération du signalement:', error);
    throw error;
  }
}

export async function fetchSignalementsByUser(userId: string): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/signalements/user/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.statusText}`);
    }

    const result: SignalementApiResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de la récupération des signalements');
    }

    return result.data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des signalements utilisateur:', error);
    throw error;
  }
}

export async function fetchSignalementsByStatus(status: string): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/signalements/status/${status}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.statusText}`);
    }

    const result: SignalementApiResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Erreur lors de la récupération des signalements');
    }

    return result.data || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des signalements par statut:', error);
    throw error;
  }
}

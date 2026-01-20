<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar color="primary">
        <ion-title>
          <div class="header-title">
            <ion-icon :icon="mapOutline" />
            <span>Travaux Routiers</span>
          </div>
        </ion-title>
        <ion-buttons slot="end">
          <ion-button @click="refreshData" :disabled="loading">
            <ion-icon :icon="refreshOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <!-- Tableau Récapitulatif -->
      <div class="recap-container">
        <div class="recap-card">
          <div class="recap-item">
            <div class="recap-value">{{ recap.nbSignalements }}</div>
            <div class="recap-label">Signalements</div>
          </div>
          <div class="recap-divider"></div>
          <div class="recap-item">
            <div class="recap-value">{{ formatSurface(recap.surfaceTotale) }}</div>
            <div class="recap-label">Surface (m²)</div>
          </div>
          <div class="recap-divider"></div>
          <div class="recap-item">
            <div class="recap-value">{{ recap.avancementPct }}%</div>
            <div class="recap-label">Avancement</div>
          </div>
          <div class="recap-divider"></div>
          <div class="recap-item">
            <div class="recap-value">{{ formatBudget(recap.budgetTotal) }}</div>
            <div class="recap-label">Budget (MGA)</div>
          </div>
        </div>
      </div>

      <!-- Filtres -->
      <div class="filter-container">
        <ion-segment v-model="viewMode" mode="ios">
          <ion-segment-button value="all">
            <ion-label>Tous</ion-label>
          </ion-segment-button>
          <ion-segment-button value="mine">
            <ion-label>Mes signalements</ion-label>
          </ion-segment-button>
        </ion-segment>

        <ion-chip-group>
          <ion-chip 
            v-for="status in statusOptions" 
            :key="status.value"
            :outline="statusFilter !== status.value"
            :color="status.color"
            @click="statusFilter = status.value"
          >
            <ion-icon :icon="status.icon" />
            <ion-label>{{ status.label }}</ion-label>
          </ion-chip>
        </ion-chip-group>
      </div>

      <!-- Carte Leaflet -->
      <div class="map-container">
        <div ref="mapElement" class="map"></div>
        
        <!-- Bouton de localisation -->
        <ion-fab vertical="bottom" horizontal="end" slot="fixed" class="location-fab">
          <ion-fab-button size="small" color="light" @click="centerOnMyLocation">
            <ion-icon :icon="locateOutline" />
          </ion-fab-button>
        </ion-fab>

        <!-- Bouton Signaler -->
        <ion-fab vertical="bottom" horizontal="center" slot="fixed" class="signal-fab">
          <ion-fab-button color="danger" @click="openSignalementModal">
            <ion-icon :icon="addOutline" />
          </ion-fab-button>
        </ion-fab>
      </div>

      <!-- Modal de création de signalement -->
      <ion-modal :is-open="isModalOpen" @didDismiss="closeModal" :breakpoints="[0, 0.5, 0.9]" :initialBreakpoint="0.5">
        <ion-header>
          <ion-toolbar color="danger">
            <ion-title>Nouveau Signalement</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="closeModal">
                <ion-icon :icon="closeOutline" />
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div class="modal-content">
            <div class="location-preview">
              <ion-icon :icon="locationOutline" color="danger" />
              <div class="location-coords">
                <span>Lat: {{ selectedLocation?.lat.toFixed(6) }}</span>
                <span>Lng: {{ selectedLocation?.lng.toFixed(6) }}</span>
              </div>
            </div>

            <ion-button 
              expand="block" 
              color="primary"
              @click="submitNewSignalement"
              :disabled="submitting || !selectedLocation"
            >
              <ion-spinner v-if="submitting" name="crescent" />
              <span v-else>
                <ion-icon :icon="sendOutline" slot="start" />
                Envoyer le signalement
              </span>
            </ion-button>

            <p class="modal-hint">
              Appuyez sur la carte pour changer l'emplacement du signalement.
            </p>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Toast de notification -->
      <ion-toast
        :is-open="toastOpen"
        :message="toastMessage"
        :color="toastColor"
        :duration="3000"
        @didDismiss="toastOpen = false"
        position="top"
      />

      <!-- Loading -->
      <ion-loading :is-open="loading" message="Chargement..." />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonButtons, IonIcon, IonSegment, IonSegmentButton,
  IonLabel, IonChip, IonFab, IonFabButton, IonModal,
  IonSpinner, IonToast, IonLoading,
} from "@ionic/vue";
import {
  mapOutline, refreshOutline, locateOutline, addOutline,
  closeOutline, locationOutline, sendOutline,
  alertCircleOutline, timeOutline, checkmarkCircleOutline, ellipseOutline,
} from "ionicons/icons";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { auth } from "@/Firebase/FirebaseConfig";
import {
  fetchAllSignalements,
  fetchMySignalements,
  prepareSignalementPayload,
  submitSignalement,
  calculateRecapitulatif,
} from "@/services/signalement";
import type { SignalementRecord, RecapitulatifData, SignalementStatus } from "@/types/signalement";
import { STATUS_COLORS } from "@/types/signalement";

// Refs
const mapElement = ref<HTMLElement | null>(null);
let mapInstance: L.Map | null = null;
let signalementLayer: L.LayerGroup | null = null;
let selectedMarker: L.Marker | null = null;

// State
const loading = ref(false);
const submitting = ref(false);
const isModalOpen = ref(false);
const viewMode = ref<"all" | "mine">("all");
const statusFilter = ref<SignalementStatus | "all">("all");
const selectedLocation = ref<{ lat: number; lng: number } | null>(null);
const allSignalements = ref<SignalementRecord[]>([]);
const mySignalements = ref<SignalementRecord[]>([]);

// Toast
const toastOpen = ref(false);
const toastMessage = ref("");
const toastColor = ref("success");

// Status options pour les filtres
const statusOptions = [
  { value: "all", label: "Tous", color: "medium", icon: ellipseOutline },
  { value: "nouveau", label: "Nouveau", color: "danger", icon: alertCircleOutline },
  { value: "en_cours", label: "En cours", color: "warning", icon: timeOutline },
  { value: "termine", label: "Terminé", color: "success", icon: checkmarkCircleOutline },
];

// Computed
const filteredSignalements = computed(() => {
  const source = viewMode.value === "mine" ? mySignalements.value : allSignalements.value;
  if (statusFilter.value === "all") return source;
  return source.filter(s => s.status === statusFilter.value);
});

const recap = computed<RecapitulatifData>(() => {
  return calculateRecapitulatif(filteredSignalements.value);
});

// Formatters
const formatSurface = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(0);
};

const formatBudget = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return value.toFixed(0);
};

const formatDate = (date: Date | null) => {
  if (!date) return "N/A";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
};

// Methods
const showToast = (message: string, color: string = "success") => {
  toastMessage.value = message;
  toastColor.value = color;
  toastOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false;
  if (selectedMarker) {
    selectedMarker.remove();
    selectedMarker = null;
  }
};

const openSignalementModal = () => {
  if (!auth.currentUser) {
    showToast("Connectez-vous pour signaler un problème", "warning");
    return;
  }
  // Utiliser le centre de la carte par défaut
  if (mapInstance) {
    const center = mapInstance.getCenter();
    selectedLocation.value = { lat: center.lat, lng: center.lng };
    updateSelectedMarker(center.lat, center.lng);
  }
  isModalOpen.value = true;
};

const updateSelectedMarker = (lat: number, lng: number) => {
  if (!mapInstance) return;

  const redIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  if (selectedMarker) {
    selectedMarker.setLatLng([lat, lng]);
  } else {
    selectedMarker = L.marker([lat, lng], { icon: redIcon }).addTo(mapInstance);
  }
  selectedLocation.value = { lat, lng };
};

const submitNewSignalement = async () => {
  if (!selectedLocation.value || !auth.currentUser) return;

  submitting.value = true;
  try {
    const payload = prepareSignalementPayload(
      selectedLocation.value.lat,
      selectedLocation.value.lng
    );
    await submitSignalement(payload);
    showToast("Signalement envoyé avec succès !");
    closeModal();
    await refreshData();
  } catch (error: any) {
    showToast(error.message || "Erreur lors de l'envoi", "danger");
  } finally {
    submitting.value = false;
  }
};

const centerOnMyLocation = () => {
  if (!navigator.geolocation || !mapInstance) {
    showToast("Géolocalisation non disponible", "warning");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      mapInstance?.setView([latitude, longitude], 16);
    },
    () => showToast("Impossible d'obtenir votre position", "danger")
  );
};

const refreshData = async () => {
  loading.value = true;
  try {
    allSignalements.value = await fetchAllSignalements();
    if (auth.currentUser) {
      mySignalements.value = await fetchMySignalements(auth.currentUser.uid);
    }
    refreshMarkers();
  } catch (error: any) {
    showToast("Erreur de chargement", "danger");
  } finally {
    loading.value = false;
  }
};

const refreshMarkers = () => {
  if (!mapInstance) return;

  if (!signalementLayer) {
    signalementLayer = L.layerGroup().addTo(mapInstance);
  }
  signalementLayer.clearLayers();

  filteredSignalements.value.forEach((item) => {
    if (item.latitude == null || item.longitude == null) return;

    // Créer un marqueur coloré selon le statut
    const color = item.status === "nouveau" ? "red" : 
                  item.status === "en_cours" ? "orange" : "green";
    
    const icon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="background-color: ${item.statusCouleur}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const popupContent = `
      <div class="popup-content">
        <div class="popup-header" style="background: ${item.statusCouleur}">
          <strong>${item.statusLabel}</strong>
        </div>
        <div class="popup-body">
          <p><strong>Date:</strong> ${formatDate(item.dateSignalement)}</p>
          ${item.surfaceM2 ? `<p><strong>Surface:</strong> ${item.surfaceM2} m²</p>` : ''}
          ${item.budget ? `<p><strong>Budget:</strong> ${item.budget.toLocaleString()} MGA</p>` : ''}
          ${item.entrepriseNom ? `<p><strong>Entreprise:</strong> ${item.entrepriseNom}</p>` : ''}
          ${item.commentaire ? `<p><em>${item.commentaire}</em></p>` : ''}
        </div>
      </div>
    `;

    L.marker([item.latitude, item.longitude], { icon })
      .bindPopup(popupContent, { className: 'custom-popup' })
      .addTo(signalementLayer as L.LayerGroup);
  });
};

// Lifecycle
onMounted(async () => {
  if (!mapElement.value) return;

  // Fix Leaflet icons
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  // Initialiser la carte centrée sur Antananarivo
  mapInstance = L.map(mapElement.value).setView([-18.8792, 47.5079], 13);
  
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(mapInstance);

  // Clic sur la carte = sélection de position
  mapInstance.on("click", (e: L.LeafletMouseEvent) => {
    if (isModalOpen.value) {
      updateSelectedMarker(e.latlng.lat, e.latlng.lng);
    }
  });

  setTimeout(() => mapInstance?.invalidateSize(), 200);

  await refreshData();
});

watch([viewMode, statusFilter], () => {
  refreshMarkers();
});

onBeforeUnmount(() => {
  mapInstance?.remove();
  mapInstance = null;
});
</script>

<style scoped>
.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.recap-container {
  padding: 12px;
  background: linear-gradient(135deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%);
}

.recap-card {
  display: flex;
  justify-content: space-around;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 16px 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.recap-item {
  text-align: center;
  flex: 1;
}

.recap-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ion-color-primary);
}

.recap-label {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.recap-divider {
  width: 1px;
  background: var(--ion-color-light-shade);
}

.filter-container {
  padding: 12px;
  background: var(--ion-background-color);
}

ion-chip-group {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.map-container {
  position: absolute;
  top: 220px;
  left: 0;
  right: 0;
  bottom: 0;
}

.map {
  width: 100%;
  height: 100%;
}

.location-fab {
  margin-bottom: 80px;
  margin-right: 8px;
}

.signal-fab {
  margin-bottom: 16px;
}

.modal-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.location-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--ion-color-light);
  border-radius: 12px;
}

.location-preview ion-icon {
  font-size: 2rem;
}

.location-coords {
  display: flex;
  flex-direction: column;
  font-family: monospace;
  font-size: 0.9rem;
}

.modal-hint {
  text-align: center;
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}

:deep(.custom-popup .leaflet-popup-content-wrapper) {
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
}

:deep(.custom-popup .leaflet-popup-content) {
  margin: 0;
  min-width: 180px;
}

:deep(.popup-header) {
  padding: 8px 12px;
  color: white;
  font-weight: 600;
}

:deep(.popup-body) {
  padding: 12px;
}

:deep(.popup-body p) {
  margin: 4px 0;
  font-size: 0.85rem;
}
</style>

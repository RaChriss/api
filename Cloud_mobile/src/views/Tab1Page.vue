<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Signalement</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Signalement</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="segment-wrapper">
        <ion-segment v-model="viewMode" value="map">
          <ion-segment-button value="map">
            <ion-label>Carte</ion-label>
          </ion-segment-button>
          <ion-segment-button value="mine">
            <ion-label>Mes signalements</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>

      <div v-if="viewMode === 'map'" class="map-wrapper" style="position: absolute; top: 60px; left: 0; right: 0; bottom: 0;">
        <div ref="mapElement" class="map"></div>
        <div class="map-controls">
          <ion-item lines="none">
            <ion-label>Statut</ion-label>
            <ion-select v-model="statusFilter" interface="popover">
              <ion-select-option value="all">Tous</ion-select-option>
              <ion-select-option value="nouveau">Nouveau</ion-select-option>
              <ion-select-option value="en_cours">En cours</ion-select-option>
              <ion-select-option value="termine">Termine</ion-select-option>
            </ion-select>
          </ion-item>
          <ion-button expand="block" color="medium" @click="fitMyBounds">
            Voir mes signalements
          </ion-button>
        </div>
        <div class="map-hint">
          <ion-text>Appuyez sur la carte pour signaler un probleme.</ion-text>
        </div>
      </div>

      <div v-else class="list-wrapper">
        <div class="button-row">
          <ion-button expand="block" color="medium" @click="loadMySignalements" :disabled="loadingList">
            <ion-spinner v-if="loadingList" name="crescent" />
            <span v-else>Actualiser</span>
          </ion-button>
        </div>

        <ion-list v-if="filteredMySignalements.length">
          <ion-item v-for="item in filteredMySignalements" :key="item.id">
            <ion-label>
              <h2>{{ item.title }}</h2>
              <p>{{ item.description }}</p>
              <p v-if="item.createdAt">Le {{ formatDate(item.createdAt) }}</p>
              <p>Statut: {{ item.status }}</p>
            </ion-label>
            <ion-note slot="end">
              <div v-if="item.surfaceM2">Surface: {{ item.surfaceM2 }} m2</div>
              <div v-if="item.budget">Budget: {{ item.budget }} MGA</div>
            </ion-note>
          </ion-item>
        </ion-list>

        <div v-else class="empty-state">
          <ion-text color="medium">
            {{ listMessage }}
          </ion-text>
        </div>
      </div>

      <ion-modal :is-open="isModalOpen" @didDismiss="closeModal">
        <ion-header>
          <ion-toolbar>
            <ion-title>Nouveau signalement</ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-item>
            <ion-label position="floating">Titre</ion-label>
            <ion-input v-model="form.title" placeholder="Nid de poule, route abimee..." />
          </ion-item>

          <ion-item>
            <ion-label position="floating">Description</ion-label>
            <ion-textarea
              v-model="form.description"
              auto-grow
              placeholder="Decrivez le probleme"
            />
          </ion-item>

          <ion-item>
            <ion-label position="floating">Surface (m2)</ion-label>
            <ion-input v-model="form.surfaceM2" inputmode="decimal" />
          </ion-item>

          <ion-item>
            <ion-label position="floating">Budget (MGA)</ion-label>
            <ion-input v-model="form.budget" inputmode="decimal" />
          </ion-item>

          <ion-item>
            <ion-label position="floating">Latitude</ion-label>
            <ion-input v-model="form.latitude" inputmode="decimal" />
          </ion-item>

          <ion-item>
            <ion-label position="floating">Longitude</ion-label>
            <ion-input v-model="form.longitude" inputmode="decimal" />
          </ion-item>

          <div class="button-row">
            <ion-button
              expand="block"
              color="medium"
              @click="fillLocation"
              :disabled="locating"
            >
              <ion-spinner v-if="locating" name="crescent" />
              <span v-else>Utiliser ma position</span>
            </ion-button>
          </div>

          <div class="button-row">
            <ion-button expand="block" @click="submit" :disabled="loading">
              <ion-spinner v-if="loading" name="crescent" />
              <span v-else>Envoyer le signalement</span>
            </ion-button>
          </div>

          <div v-if="message" class="message" :class="messageType">
            <ion-text :color="messageType">{{ message }}</ion-text>
          </div>
        </ion-content>
      </ion-modal>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonButton,
  IonText,
  IonSpinner,
  IonModal,
  IonSegment,
  IonSegmentButton,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
} from "@ionic/vue";
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
} from "@/services/signalement";
import type { SignalementFormInput } from "@/services/signalement";
import type { SignalementRecord, SignalementStatus } from "@/types/signalement";

const mapElement = ref<HTMLElement | null>(null);
const isModalOpen = ref(false);
const viewMode = ref<"map" | "mine">("map");
const statusFilter = ref<SignalementStatus | "all">("all");

let mapInstance: L.Map | null = null;
let marker: L.Marker | null = null;
let signalementLayer: L.LayerGroup | null = null;

const form = ref<SignalementFormInput>({
  title: "",
  description: "",
  surfaceM2: "",
  budget: "",
  latitude: "",
  longitude: "",
});

const loading = ref(false);
const locating = ref(false);
const message = ref("");
const messageType = ref<"" | "success" | "danger">("");
const mySignalements = ref<SignalementRecord[]>([]);
const allSignalements = ref<SignalementRecord[]>([]);
const loadingList = ref(false);
const listMessage = ref("Aucun signalement pour le moment.");
const loadingAll = ref(false);

const filteredMySignalements = computed(() => {
  if (statusFilter.value === "all") {
    return mySignalements.value;
  }
  return mySignalements.value.filter((item) => item.status === statusFilter.value);
});

const filteredAllSignalements = computed(() => {
  if (statusFilter.value === "all") {
    return allSignalements.value;
  }
  return allSignalements.value.filter((item) => item.status === statusFilter.value);
});

const closeModal = () => {
  isModalOpen.value = false;
};

const renderError = (text: string) => {
  message.value = text;
  messageType.value = "danger";
};

const resetForm = () => {
  form.value = {
    title: "",
    description: "",
    surfaceM2: "",
    budget: "",
    latitude: "",
    longitude: "",
  };
};

const submit = async () => {
  if (!auth.currentUser) {
    message.value = "Vous devez etre connecte pour envoyer un signalement.";
    messageType.value = "danger";
    return;
  }
  const payload = prepareSignalementPayload(form.value);
  if (!payload.title || !payload.description) {
    message.value = "Titre et description sont obligatoires.";
    messageType.value = "danger";
    return;
  }
  if (payload.latitude == null || payload.longitude == null) {
    message.value = "Veuillez selectionner un point sur la carte.";
    messageType.value = "danger";
    return;
  }

  loading.value = true;
  message.value = "";
  messageType.value = "";

  try {
    await submitSignalement(payload);
    message.value = "Signalement envoye avec succes.";
    messageType.value = "success";
    resetForm();
    if (auth.currentUser) {
      loadMySignalements();
    }
    loadAllSignalements();
  } catch (error: any) {
    message.value = `Erreur: ${error?.message ?? "envoi impossible"}`;
    messageType.value = "danger";
  } finally {
    loading.value = false;
  }
};

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const loadMySignalements = async () => {
  if (!auth.currentUser) {
    listMessage.value = "Connectez-vous pour voir vos signalements.";
    mySignalements.value = [];
    return;
  }

  loadingList.value = true;
  listMessage.value = "Chargement...";

  try {
    const items = await fetchMySignalements(auth.currentUser.uid);
    mySignalements.value = items;
    if (!items.length) {
      listMessage.value = "Aucun signalement pour le moment.";
    }
  } catch (error: any) {
    listMessage.value = error?.message ?? "Impossible de charger les signalements.";
  } finally {
    loadingList.value = false;
  }
};

const loadAllSignalements = async () => {
  loadingAll.value = true;
  try {
    allSignalements.value = await fetchAllSignalements();
  } catch (error: any) {
    message.value = error?.message ?? "Impossible de charger la carte.";
    messageType.value = "danger";
  } finally {
    loadingAll.value = false;
  }
};

const updateMarker = (latitude: number, longitude: number) => {
  if (!mapInstance) {
    return;
  }
  if (marker) {
    marker.setLatLng([latitude, longitude]);
  } else {
    marker = L.marker([latitude, longitude]).addTo(mapInstance);
  }
};

const refreshSignalementMarkers = () => {
  if (!mapInstance) {
    return;
  }

  if (!signalementLayer) {
    signalementLayer = L.layerGroup().addTo(mapInstance);
  }

  signalementLayer.clearLayers();

  filteredAllSignalements.value.forEach((item) => {
    if (item.latitude == null || item.longitude == null) {
      return;
    }

    const popup = `
      <strong>${item.title}</strong><br/>
      ${item.description}<br/>
      Statut: ${item.status}<br/>
      ${item.surfaceM2 ? `Surface: ${item.surfaceM2} m2<br/>` : ""}
      ${item.budget ? `Budget: ${item.budget} MGA<br/>` : ""}
    `;

    L.marker([item.latitude, item.longitude])
      .bindPopup(popup)
      .addTo(signalementLayer as L.LayerGroup);
  });
};

const fitMyBounds = () => {
  if (!mapInstance) {
    return;
  }

  const coords = filteredMySignalements.value
    .filter((item) => item.latitude != null && item.longitude != null)
    .map((item) => [item.latitude as number, item.longitude as number]);

  if (!coords.length) {
    message.value = "Aucun signalement a afficher.";
    messageType.value = "danger";
    return;
  }

  mapInstance.fitBounds(coords as L.LatLngBoundsExpression, { padding: [40, 40] });
};

const openSignalementModal = (latitude: number, longitude: number) => {
  form.value.latitude = latitude.toString();
  form.value.longitude = longitude.toString();
  updateMarker(latitude, longitude);
  message.value = "";
  messageType.value = "";
  isModalOpen.value = true;
};

const fillLocation = () => {
  if (!navigator.geolocation) {
    renderError("Geolocalisation non disponible.");
    return;
  }

  locating.value = true;
  message.value = "";
  messageType.value = "";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      openSignalementModal(position.coords.latitude, position.coords.longitude);
      locating.value = false;
    },
    () => {
      renderError("Impossible de recuperer la position.");
      locating.value = false;
    }
  );
};

onMounted(() => {
  if (!mapElement.value) {
    return;
  }

  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });

  mapInstance = L.map(mapElement.value).setView([-18.8792, 47.5079], 15);
  try {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(mapInstance);
    // ensure Leaflet recalculates container size after render
    setTimeout(() => {
      mapInstance?.invalidateSize();
    }, 300);
  } catch {
    renderError("Impossible de charger les tuiles de carte.");
  }

  mapInstance.on("click", (event: L.LeafletMouseEvent) => {
    openSignalementModal(event.latlng.lat, event.latlng.lng);
  });

  loadAllSignalements().then(() => {
    refreshSignalementMarkers();
  });

  if (auth.currentUser) {
    loadMySignalements().then(() => {
      refreshSignalementMarkers();
    });
  }
});

watch(
  viewMode,
  (current) => {
    if (current === "mine") {
      loadMySignalements();
    }
    if (current === "map") {
      if (!allSignalements.value.length && !loadingAll.value) {
        loadAllSignalements();
      }
      refreshSignalementMarkers();
      if (mapInstance) {
        setTimeout(() => {
          mapInstance?.invalidateSize();
        }, 200);
      }
    }
  },
  { immediate: false }
);

watch([mySignalements, allSignalements, statusFilter], () => {
  refreshSignalementMarkers();
});

onBeforeUnmount(() => {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
});
</script>

<style scoped>
.button-row {
  margin-top: 14px;
}

.message {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
}

.message.success {
  background-color: rgba(16, 220, 96, 0.1);
}

.message.danger {
  background-color: rgba(235, 68, 90, 0.1);
}

.map-wrapper {
  /* position the map between the header and the tabbar using Ionic CSS variables */
  position: absolute;
  left: 0;
  right: 0;
  top: calc(var(--ion-safe-area-top, 0px) + var(--ion-toolbar-height, 56px));
  bottom: calc(var(--ion-tabbar-height, 56px) + var(--ion-safe-area-bottom, 0px));
  width: 100%;
}

.map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.map-hint {
  position: absolute; 
  left: 12px;
  right: 12px;
  bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.map-controls {
  position: absolute;
  left: 12px;
  right: 12px;
  top: 12px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1000;
}

.segment-wrapper {
  padding: 8px 12px 0;
}

.list-wrapper {
  padding: 0 12px 24px;
}

.empty-state {
  margin-top: 24px;
  text-align: center;
}
</style>

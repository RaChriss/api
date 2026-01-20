<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom" color="primary">
        <ion-tab-button tab="map" href="/tabs/map">
          <ion-icon :icon="mapOutline" />
          <ion-label>Carte</ion-label>
        </ion-tab-button>
        <ion-tab-button @click="handleLogout">
          <ion-icon :icon="logOutOutline" />
          <ion-label>Déconnexion</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet } from '@ionic/vue';
import { mapOutline, logOutOutline } from 'ionicons/icons';
import { useRouter } from 'vue-router';
import { signOut } from 'firebase/auth';
import { auth } from '@/Firebase/FirebaseConfig';

const router = useRouter();

const handleLogout = async () => {
  try {
    await signOut(auth);
    router.replace('/login');
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
  }
};
</script>

<style scoped>
ion-tab-bar {
  --background: var(--ion-color-primary);
  --color: rgba(255, 255, 255, 0.7);
  --color-selected: white;
}
</style>

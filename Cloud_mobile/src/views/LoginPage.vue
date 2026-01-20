<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Test Firebase Auth</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="ion-padding">
      <div class="login-container">
        <ion-card>
          <ion-card-header>
            <ion-card-title>Connexion / Inscription</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-item>
              <ion-label position="floating">Adresse email</ion-label>
              <ion-input v-model="email" type="email" placeholder="votre@email.com"></ion-input>
            </ion-item>
            
            <ion-item>
              <ion-label position="floating">Mot de passe</ion-label>
              <ion-input v-model="password" type="password" placeholder="••••••••"></ion-input>
            </ion-item>

            <div class="button-container">
              <ion-button expand="block" @click="signUp" :disabled="loading">
                <ion-spinner v-if="loading && action === 'signup'" name="crescent"></ion-spinner>
                <span v-else>S'inscrire</span>
              </ion-button>
              
              <ion-button expand="block" color="secondary" @click="signIn" :disabled="loading">
                <ion-spinner v-if="loading && action === 'signin'" name="crescent"></ion-spinner>
                <span v-else>Se connecter</span>
              </ion-button>

              <ion-button expand="block" color="danger" @click="signOut" :disabled="loading || !user">
                Se déconnecter
              </ion-button>
            </div>

            <div v-if="message" class="message" :class="messageType">
              <ion-text :color="messageType">{{ message }}</ion-text>
            </div>

            <div v-if="user" class="user-info">
              <ion-text color="success">
                <h3>Utilisateur connecté:</h3>
                <p>Email: {{ user.email }}</p>
                <p>UID: {{ user.uid }}</p>
              </ion-text>
            </div>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonSpinner
} from '@ionic/vue';
import { auth } from '@/Firebase/FirebaseConfig';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';

const router = useRouter();

const email = ref('');
const password = ref('');
const loading = ref(false);
const action = ref('');
const message = ref('');
const messageType = ref('');
const user = ref<User | null>(null);

// Écouter les changements d'état d'authentification
onAuthStateChanged(auth, (currentUser) => {
  user.value = currentUser;
});

const signUp = async () => {
  if (!email.value || !password.value) {
    showMessage('Veuillez remplir tous les champs', 'danger');
    return;
  }
  
  loading.value = true;
  action.value = 'signup';
  message.value = '';
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value);
    showMessage(`Compte créé avec succès! Redirection...`, 'success');
    email.value = '';
    password.value = '';
    // Redirection vers les tabs après l'inscription
    setTimeout(() => {
      router.replace('/tabs/tab1');
    }, 1000);
  } catch (error: any) {
    showMessage(`Erreur: ${error.message}`, 'danger');
  } finally {
    loading.value = false;
    action.value = '';
  }
};

const signIn = async () => {
  if (!email.value || !password.value) {
    showMessage('Veuillez remplir tous les champs', 'danger');
    return;
  }
  
  loading.value = true;
  action.value = 'signin';
  message.value = '';
  
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.value, password.value);
    showMessage(`Connexion réussie! Redirection...`, 'success');
    email.value = '';
    password.value = '';
    // Redirection vers les tabs après la connexion
    setTimeout(() => {
      router.replace('/tabs/tab1');
    }, 1000);
  } catch (error: any) {
    showMessage(`Erreur: ${error.message}`, 'danger');
  } finally {
    loading.value = false;
    action.value = '';
  }
};

const signOut = async () => {
  loading.value = true;
  message.value = '';
  
  try {
    await firebaseSignOut(auth);
    showMessage('Déconnexion réussie', 'success');
  } catch (error: any) {
    showMessage(`Erreur: ${error.message}`, 'danger');
  } finally {
    loading.value = false;
  }
};

const showMessage = (msg: string, type: string) => {
  message.value = msg;
  messageType.value = type;
};
</script>

<style scoped>
.login-container {
  max-width: 500px;
  margin: 40px auto;
}

.button-container {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.message {
  margin-top: 20px;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
}

.message.success {
  background-color: rgba(16, 220, 96, 0.1);
}

.message.danger {
  background-color: rgba(235, 68, 90, 0.1);
}

.user-info {
  margin-top: 20px;
  padding: 15px;
  border-radius: 8px;
  background-color: rgba(16, 220, 96, 0.1);
}

.user-info h3 {
  margin-top: 0;
}

.user-info p {
  margin: 5px 0;
  font-size: 14px;
}

ion-item {
  margin-bottom: 10px;
}
</style>

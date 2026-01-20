<template>
  <ion-page>
    <ion-content :fullscreen="true" class="login-content">
      <div class="login-wrapper">
        <!-- Header avec logo -->
        <div class="login-header">
          <div class="logo-container">
            <ion-icon :icon="constructOutline" class="logo-icon" />
          </div>
          <h1>Travaux Routiers</h1>
          <p>Antananarivo</p>
        </div>

        <!-- Formulaire -->
        <div class="login-form">
          <ion-item class="form-item" lines="none">
            <ion-icon :icon="mailOutline" slot="start" color="medium" />
            <ion-input
              v-model="email"
              type="email"
              placeholder="Adresse email"
              autocomplete="email"
            />
          </ion-item>

          <ion-item class="form-item" lines="none">
            <ion-icon :icon="lockClosedOutline" slot="start" color="medium" />
            <ion-input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Mot de passe"
              autocomplete="current-password"
            />
            <ion-button fill="clear" slot="end" @click="showPassword = !showPassword">
              <ion-icon :icon="showPassword ? eyeOffOutline : eyeOutline" color="medium" />
            </ion-button>
          </ion-item>

          <ion-button
            expand="block"
            class="login-button"
            @click="signIn"
            :disabled="loading"
          >
            <ion-spinner v-if="loading && action === 'signin'" name="crescent" />
            <span v-else>Se connecter</span>
          </ion-button>

          <div class="divider">
            <span>ou</span>
          </div>

          <ion-button
            expand="block"
            fill="outline"
            class="signup-button"
            @click="signUp"
            :disabled="loading"
          >
            <ion-spinner v-if="loading && action === 'signup'" name="crescent" />
            <span v-else>Créer un compte</span>
          </ion-button>
        </div>

        <!-- Info utilisateur connecté -->
        <div v-if="user" class="user-info">
          <ion-icon :icon="checkmarkCircleOutline" color="success" />
          <span>{{ user.email }}</span>
          <ion-button fill="clear" size="small" color="danger" @click="signOut">
            <ion-icon :icon="logOutOutline" />
          </ion-button>
        </div>

        <!-- Footer -->
        <div class="login-footer">
          <p>Projet Cloud S5 - ITU</p>
        </div>
      </div>

      <!-- Toast -->
      <ion-toast
        :is-open="toastOpen"
        :message="toastMessage"
        :color="toastColor"
        :duration="3000"
        @didDismiss="toastOpen = false"
        position="top"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonContent, IonItem, IonInput, IonButton,
  IonIcon, IonSpinner, IonToast,
} from '@ionic/vue';
import {
  constructOutline, mailOutline, lockClosedOutline,
  eyeOutline, eyeOffOutline, checkmarkCircleOutline, logOutOutline,
} from 'ionicons/icons';
import { auth } from '@/Firebase/FirebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';

const router = useRouter();

// Form
const email = ref('');
const password = ref('');
const showPassword = ref(false);

// State
const loading = ref(false);
const action = ref('');
const user = ref<User | null>(null);

// Toast
const toastOpen = ref(false);
const toastMessage = ref('');
const toastColor = ref('success');

const showToast = (msg: string, color: string = 'success') => {
  toastMessage.value = msg;
  toastColor.value = color;
  toastOpen.value = true;
};

const validateForm = (): boolean => {
  if (!email.value || !password.value) {
    showToast('Veuillez remplir tous les champs', 'warning');
    return false;
  }
  if (!email.value.includes('@')) {
    showToast('Email invalide', 'warning');
    return false;
  }
  if (password.value.length < 6) {
    showToast('Le mot de passe doit contenir au moins 6 caractères', 'warning');
    return false;
  }
  return true;
};

const signUp = async () => {
  if (!validateForm()) return;

  loading.value = true;
  action.value = 'signup';

  try {
    await createUserWithEmailAndPassword(auth, email.value, password.value);
    showToast('Compte créé avec succès !');
    email.value = '';
    password.value = '';
    setTimeout(() => router.replace('/tabs/map'), 1000);
  } catch (error: any) {
    const msg = error.code === 'auth/email-already-in-use' 
      ? 'Cet email est déjà utilisé'
      : error.message;
    showToast(msg, 'danger');
  } finally {
    loading.value = false;
    action.value = '';
  }
};

const signIn = async () => {
  if (!validateForm()) return;

  loading.value = true;
  action.value = 'signin';

  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
    showToast('Connexion réussie !');
    email.value = '';
    password.value = '';
    setTimeout(() => router.replace('/tabs/map'), 1000);
  } catch (error: any) {
    const msg = error.code === 'auth/invalid-credential'
      ? 'Email ou mot de passe incorrect'
      : error.message;
    showToast(msg, 'danger');
  } finally {
    loading.value = false;
    action.value = '';
  }
};

const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    showToast('Déconnexion réussie');
  } catch (error: any) {
    showToast(error.message, 'danger');
  }
};

onMounted(() => {
  onAuthStateChanged(auth, (currentUser) => {
    user.value = currentUser;
  });
});
</script>

<style scoped>
.login-content {
  --background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

.login-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 24px;
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
  color: white;
}

.logo-container {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  box-shadow: 0 8px 32px rgba(233, 69, 96, 0.3);
}

.logo-icon {
  font-size: 2.5rem;
  color: white;
}

.login-header h1 {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0;
}

.login-header p {
  font-size: 1rem;
  opacity: 0.7;
  margin: 4px 0 0;
}

.login-form {
  width: 100%;
  max-width: 360px;
}

.form-item {
  --background: rgba(255, 255, 255, 0.1);
  --border-radius: 12px;
  --padding-start: 16px;
  --padding-end: 16px;
  margin-bottom: 16px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.form-item ion-input {
  --color: white;
  --placeholder-color: rgba(255, 255, 255, 0.5);
}

.login-button {
  --background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
  --border-radius: 12px;
  --box-shadow: 0 4px 16px rgba(233, 69, 96, 0.3);
  height: 52px;
  font-weight: 600;
  margin-top: 8px;
}

.divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
  color: rgba(255, 255, 255, 0.5);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
}

.divider span {
  padding: 0 16px;
  font-size: 0.85rem;
}

.signup-button {
  --border-color: rgba(255, 255, 255, 0.3);
  --color: white;
  --border-radius: 12px;
  height: 52px;
  font-weight: 600;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: white;
}

.user-info ion-icon {
  font-size: 1.2rem;
}

.login-footer {
  margin-top: auto;
  padding-top: 40px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.8rem;
}
</style>

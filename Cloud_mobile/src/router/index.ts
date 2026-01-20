import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import TabsPage from "../views/TabsPage.vue";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/Firebase/FirebaseConfig";
import { Capacitor } from "@capacitor/core";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    redirect: "/login",
  },
  {
    path: "/login",
    component: () => import("@/views/LoginPage.vue"),
  },
  {
    path: "/tabs/",
    component: TabsPage,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        redirect: "/tabs/tab1",
      },
      {
        path: "tab1",
        component: () => import("@/views/Tab1Page.vue"),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(Capacitor.convertFileSrc(import.meta.env.BASE_URL || '/')),
  routes,
});

const waitForAuthReady = () =>
  new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });

router.beforeEach(async (to) => {
  const isAuthRoute = to.path === "/login";
  
  // Attendre que l'état d'authentification soit prêt
  await waitForAuthReady();
  
  if (auth.currentUser) {
    // Si l'utilisateur est connecté et essaie d'aller au login, rediriger vers tab1
    if (isAuthRoute) {
      return { path: "/tabs/tab1", replace: true };
    }
    return true;
  }

  // Si la route nécessite l'authentification et l'utilisateur n'est pas connecté
  if (to.matched.some((record) => record.meta.requiresAuth)) {
    return { path: "/login", replace: true };
  }

  return true;
});

export default router;

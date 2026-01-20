import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import TabsPage from "../views/TabsPage.vue";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/Firebase/FirebaseConfig";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    redirect: "/login",
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/AuthPage.vue"),
  },
  {
    path: "/tabs/",
    component: TabsPage,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        redirect: "/tabs/map",
      },
      {
        path: "map",
        name: "Map",
        component: () => import("@/views/MapPage.vue"),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL || '/'),
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
  
  await waitForAuthReady();
  
  if (auth.currentUser) {
    if (isAuthRoute) {
      return { path: "/tabs/map", replace: true };
    }
    return true;
  }

  if (to.matched.some((record) => record.meta.requiresAuth)) {
    return { path: "/login", replace: true };
  }

  return true;
});

export default router;

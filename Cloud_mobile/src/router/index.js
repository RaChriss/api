import { createRouter, createWebHistory } from "@ionic/vue-router";
import TabsPage from "../views/TabsPage.vue";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/Firebase/FirebaseConfig";

const routes = [
  {
    path: "/",
    redirect: "/login"
  },
  {
    path: "/login",
    component: () => import("@/views/LoginPage.vue")
  },
  {
    path: "/tabs/",
    component: TabsPage,
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        redirect: "/tabs/tab1"
      },
      {
        path: "tab1",
        component: () => import("@/views/Tab1Page.vue")
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
  if (auth.currentUser) {
    if (isAuthRoute) {
      return "/tabs/tab1";
    }
    return true;
  }

  await waitForAuthReady();

  if (to.matched.some((record) => record.meta.requiresAuth)) {
    return "/login";
  }

  return true;
});

export default router;

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { can, CAP } from '../permissions.js'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/Home.vue') },
  { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
  { path: '/guestbook', name: 'guestbook', component: () => import('../views/Guestbook.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/Settings.vue') },
  {
    path: '/admin/users',
    name: 'admin-users',
    meta: { cap: CAP.MANAGE_USERS },
    component: () => import('../views/AdminUsers.vue'),
  },
  {
    path: '/games/:key',
    name: 'game',
    meta: { auth: true },
    component: () => import('../views/GamePlay.vue'),
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../views/NotFound.vue') },
]

const router = createRouter({
  history: createWebHistory('/m/'),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.name === 'login' && auth.isLoggedIn) return { name: 'home' }
  if (to.meta.cap && !can(auth.user, to.meta.cap)) return { name: 'home' }
  if (to.meta.auth && !auth.isLoggedIn) return { name: 'login' }
})

export default router

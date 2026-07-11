import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/Home.vue') },
  { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
  { path: '/guestbook', name: 'guestbook', component: () => import('../views/Guestbook.vue') },
  {
    path: '/admin/users',
    name: 'admin-users',
    meta: { requiresAdmin: true },
    component: () => import('../views/AdminUsers.vue'),
  },
]

const router = createRouter({
  history: createWebHistory('/m/'),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.name === 'login' && auth.isLoggedIn) return { name: 'home' }
  if (to.meta.requiresAdmin && !auth.isAdmin) return { name: 'home' }
})

export default router

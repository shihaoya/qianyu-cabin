import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { can, CAP } from '../permissions.js'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/Home.vue') },
  { path: '/login', name: 'login', component: () => import('../views/Login.vue') },
  { path: '/guestbook', name: 'guestbook', component: () => import('../views/Guestbook.vue') },
  { path: '/profile', name: 'profile', component: () => import('../views/Settings.vue') },
  {
    path: '/my-benefits',
    name: 'my-benefits',
    meta: { auth: true },
    component: () => import('../views/MyBenefits.vue'),
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    meta: { cap: CAP.MANAGE_USERS },
    component: () => import('../views/AdminUsers.vue'),
  },
  {
    path: '/admin/benefits',
    name: 'admin-benefits',
    meta: { cap: CAP.MANAGE_BENEFITS },
    component: () => import('../views/AdminBenefits.vue'),
  },
  {
    path: '/icon-studio',
    name: 'icon-studio',
    meta: { cap: CAP.OWNER_TOOLS },
    component: () => import('../views/IconStudio.vue'),
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
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  // 刷新时 token 有但 user 还没拉回来，先等 ensureUser() 再判定权限，
  // 否则有权限的管理页会被误判踢回首页。
  await auth.ensureUser()
  if (to.name === 'login' && auth.isLoggedIn) return { name: 'home' }
  if (to.meta.cap && !can(auth.user, to.meta.cap)) return { name: 'home' }
  if (to.meta.auth && !auth.isLoggedIn) return { name: 'login' }
})

export default router

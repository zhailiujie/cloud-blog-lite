import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const Navigation = () => import('@/views/public/Navigation.vue')
const Login = () => import('@/views/auth/Login.vue')
const AdminLayout = () => import('@/layouts/AdminLayout.vue')
const Dashboard = () => import('@/views/admin/Dashboard.vue')
const CategoryList = () => import('@/views/admin/CategoryList.vue')
const SiteList = () => import('@/views/admin/SiteList.vue')
const TagList = () => import('@/views/admin/TagList.vue')
const UserList = () => import('@/views/admin/UserList.vue')
const Setting = () => import('@/views/admin/Setting.vue')
const LogList = () => import('@/views/admin/LogList.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'navigation', component: Navigation },
    { path: '/login', name: 'login', component: Login },
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'admin-dashboard', component: Dashboard },
        { path: 'categories', name: 'admin-categories', component: CategoryList },
        { path: 'sites', name: 'admin-sites', component: SiteList },
        { path: 'tags', name: 'admin-tags', component: TagList },
        { path: 'users', name: 'admin-users', component: UserList },
        { path: 'settings', name: 'admin-settings', component: Setting },
        { path: 'logs', name: 'admin-logs', component: LogList },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.path === '/login') {
    if (auth.user) {
      return '/admin'
    }

    try {
      await auth.fetchMe()
      return '/admin'
    } catch {
      return true
    }
  }

  if (!to.meta.requiresAuth) {
    return true
  }

  if (auth.user) {
    return true
  }

  try {
    await auth.fetchMe()
    return true
  } catch {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router

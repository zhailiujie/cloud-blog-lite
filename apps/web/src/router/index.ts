import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore, type CurrentUser } from '@/stores/auth'

const Navigation = () => import('@/views/public/Navigation.vue')
const Login = () => import('@/views/auth/Login.vue')
const AdminLayout = () => import('@/layouts/AdminLayout.vue')
const Dashboard = () => import('@/views/admin/Dashboard.vue')
const CategoryList = () => import('@/views/admin/CategoryList.vue')
const SiteList = () => import('@/views/admin/SiteList.vue')
const TagList = () => import('@/views/admin/TagList.vue')
const ClickStats = () => import('@/views/admin/ClickStats.vue')
const UserList = () => import('@/views/admin/UserList.vue')
const Setting = () => import('@/views/admin/Setting.vue')
const LogList = () => import('@/views/admin/LogList.vue')

type UserRole = CurrentUser['role']

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
        { path: '', name: 'admin-dashboard', component: Dashboard, meta: { roles: ['admin', 'editor', 'viewer'] } },
        { path: 'categories', name: 'admin-categories', component: CategoryList, meta: { roles: ['admin', 'editor', 'viewer'] } },
        { path: 'sites', name: 'admin-sites', component: SiteList, meta: { roles: ['admin', 'editor', 'viewer'] } },
        { path: 'tags', name: 'admin-tags', component: TagList, meta: { roles: ['admin', 'editor', 'viewer'] } },
        { path: 'clicks', name: 'admin-clicks', component: ClickStats, meta: { roles: ['admin', 'editor', 'viewer'] } },
        { path: 'users', name: 'admin-users', component: UserList, meta: { roles: ['admin'] } },
        { path: 'settings', name: 'admin-settings', component: Setting, meta: { roles: ['admin'] } },
        { path: 'logs', name: 'admin-logs', component: LogList, meta: { roles: ['admin'] } },
      ],
    },
  ],
})

function resolveRoles(to: { matched: Array<{ meta: { roles?: UserRole[] } }> }) {
  for (let index = to.matched.length - 1; index >= 0; index -= 1) {
    const roles = to.matched[index]?.meta.roles
    if (roles?.length) return roles
  }
  return null
}

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

  if (!auth.user) {
    try {
      await auth.fetchMe()
    } catch {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
  }

  const roles = resolveRoles(to)
  if (roles && auth.user && !roles.includes(auth.user.role)) {
    return '/admin'
  }

  return true
})

export default router

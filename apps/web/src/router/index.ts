import { createRouter, createWebHistory } from 'vue-router'
import Navigation from '@/views/public/Navigation.vue'
import Login from '@/views/auth/Login.vue'
import AdminLayout from '@/layouts/AdminLayout.vue'
import Dashboard from '@/views/admin/Dashboard.vue'
import CategoryList from '@/views/admin/CategoryList.vue'
import SiteList from '@/views/admin/SiteList.vue'
import TagList from '@/views/admin/TagList.vue'
import UserList from '@/views/admin/UserList.vue'
import Setting from '@/views/admin/Setting.vue'
import LogList from '@/views/admin/LogList.vue'
import { useAuthStore } from '@/stores/auth'

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

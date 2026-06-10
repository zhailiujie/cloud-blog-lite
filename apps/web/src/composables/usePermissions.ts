import { computed } from 'vue'
import { useAuthStore, type CurrentUser } from '@/stores/auth'

export type UserRole = CurrentUser['role']

export function usePermissions() {
  const auth = useAuthStore()

  const role = computed(() => auth.user?.role ?? null)
  const isAdmin = computed(() => auth.user?.role === 'admin')
  const isEditor = computed(() => auth.user?.role === 'editor')
  const isViewer = computed(() => auth.user?.role === 'viewer')
  const canEdit = computed(() => auth.user?.role === 'admin' || auth.user?.role === 'editor')

  function hasRole(roles: UserRole[]) {
    return Boolean(auth.user && roles.includes(auth.user.role))
  }

  return { role, isAdmin, isEditor, isViewer, canEdit, hasRole }
}

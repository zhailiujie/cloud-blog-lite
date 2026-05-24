import { http } from './http'

export interface DashboardStats {
  counts: {
    categories: number
    sites: number
    visibleSites: number
    users: number
    logs: number
  }
  recentSites: Array<{
    id: string
    name: string
    url: string
    created_at: string
    category_name?: string | null
  }>
  recentLogs: Array<{
    id: string
    username?: string | null
    action: string
    module?: string | null
    description?: string | null
    created_at: string
  }>
}

interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

export async function getDashboardStats() {
  const response = await http.get<ApiResponse<DashboardStats>>('/admin/dashboard/stats')
  return response.data.data
}

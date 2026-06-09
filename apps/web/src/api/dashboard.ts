import { http, type ApiResponse } from './http'

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
    categoryName?: string | null
    category_name?: string | null
  }>
  popularSites: Array<{
    id: string
    name: string
    url: string
    click_count: number
    categoryName?: string | null
    category_name?: string | null
  }>
  recentLogs: Array<{
    id: string
    username?: string | null
    action: string
    module?: string | null
    description?: string | null
    createdAt?: string
    created_at: string
  }>
}



export async function getDashboardStats() {
  const response = await http.get<ApiResponse<DashboardStats>>('/admin/dashboard/stats')
  return response.data.data
}

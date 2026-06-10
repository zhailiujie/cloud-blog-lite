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

export interface ClickStatsSummary {
  totalClicks: number
  sitesWithClicks: number
}

export interface ClickStatsCategory {
  id: string
  name: string
  clickCount: number
  siteCount: number
}

export interface ClickStatsSite {
  id: string
  name: string
  url: string
  clickCount: number
  lastClickedAt?: string | null
  categoryName?: string | null
}

export interface ClickStatsResult {
  summary: ClickStatsSummary
  categoryStats: ClickStatsCategory[]
  items: ClickStatsSite[]
  total: number
  page: number
  pageSize: number
}

export async function getClickStats(params?: { categoryId?: string; keyword?: string; page?: number; pageSize?: number }) {
  const response = await http.get<ApiResponse<ClickStatsResult>>('/admin/dashboard/click-stats', { params })
  return response.data.data
}

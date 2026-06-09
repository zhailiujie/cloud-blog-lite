import { http, type ApiResponse } from './http'
import type { Tag } from './tags'

export interface Site {
  id: string
  categoryId: string
  categoryName?: string | null
  name: string
  url: string
  description?: string | null
  logo?: string | null
  account?: string | null
  password?: string | null
  sort: number
  isPinned: number
  visible: number
  clickCount: number
  lastClickedAt?: string | null
  healthStatus?: 'unknown' | 'ok' | 'error'
  httpStatus?: number | null
  lastCheckedAt?: string | null
  healthError?: string | null
  tags?: Tag[]
  tagIds?: string[]
  createdAt: string
  updatedAt: string
}

export interface SitePayload {
  categoryId: string
  name: string
  url: string
  description?: string
  logo?: string
  account?: string
  password?: string
  sort?: number
  isPinned?: number
  visible?: number
  tagIds?: string[]
}



export async function getSites(params?: { categoryId?: string; keyword?: string; visible?: number; isPinned?: number; healthStatus?: string; tagId?: string }) {
  const response = await http.get<ApiResponse<Site[]>>('/admin/sites', { params })
  return response.data.data || []
}

export async function createSite(payload: SitePayload) {
  const response = await http.post<ApiResponse<Site>>('/admin/sites', payload)
  return response.data.data
}

export async function updateSite(id: string, payload: SitePayload) {
  const response = await http.put<ApiResponse<Site>>(`/admin/sites/${id}`, payload)
  return response.data.data
}

export async function deleteSite(id: string) {
  const response = await http.delete<ApiResponse<boolean>>(`/admin/sites/${id}`)
  return response.data.data
}

export async function checkSite(id: string) {
  const response = await http.post<ApiResponse<{ healthStatus: 'unknown' | 'ok' | 'error'; httpStatus: number | null; lastCheckedAt: string; healthError: string }>>(`/admin/sites/${id}/check`)
  return response.data.data
}

export async function checkAllSites() {
  const response = await http.post<ApiResponse<{ checked: number }>>('/admin/sites/check-all')
  return response.data.data
}

export interface SiteImportResult {
  importedCategories: number
  importedTags: number
  importedSites: number
  skippedSites?: number
  dryRun?: boolean
}

export async function exportSiteData() {
  const response = await http.get<ApiResponse<unknown>>('/admin/sites/export')
  return response.data.data
}

export async function importSiteData(payload: unknown, dryRun = false) {
  const response = await http.post<ApiResponse<SiteImportResult>>('/admin/sites/import', payload, { params: dryRun ? { dryRun: 1 } : undefined })
  return response.data.data
}

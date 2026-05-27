import { http, type ApiResponse } from './http'

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
  visible: number
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
  visible?: number
}



export async function getSites(params?: { categoryId?: string; keyword?: string; visible?: number }) {
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

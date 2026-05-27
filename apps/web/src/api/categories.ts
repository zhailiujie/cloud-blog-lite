import { http, type ApiResponse } from './http'
import { normalizePaginatedResult, type PaginatedResult } from './types'

export interface Category {
  id: string
  parentId: string
  name: string
  icon?: string
  sort: number
  level?: number | null
  visible: number
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

export interface CategoryPayload {
  parentId?: string
  name: string
  icon?: string
  sort?: number
  level?: number | null
  visible?: number
}



export async function getCategories(params?: { page?: number; pageSize?: number }): Promise<PaginatedResult<Category>> {
  const response = await http.get<ApiResponse<Category[] | PaginatedResult<Category>>>('/admin/categories', { params })
  return normalizePaginatedResult(response.data.data, params?.page, params?.pageSize)
}

export async function getCategoryOptions(): Promise<Category[]> {
  const response = await http.get<ApiResponse<Category[]>>('/admin/categories/options')
  return response.data.data || []
}

export async function createCategory(payload: CategoryPayload) {
  const response = await http.post<ApiResponse<Category>>('/admin/categories', payload)
  return response.data.data
}

export async function updateCategory(id: string, payload: CategoryPayload) {
  const response = await http.put<ApiResponse<Category>>(`/admin/categories/${id}`, payload)
  return response.data.data
}

export async function deleteCategory(id: string) {
  const response = await http.delete<ApiResponse<boolean>>(`/admin/categories/${id}`)
  return response.data.data
}

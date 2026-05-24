import { http } from './http'

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

interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

export async function getCategories() {
  const response = await http.get<ApiResponse<Category[]>>('/admin/categories')
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

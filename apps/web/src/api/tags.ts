import { http, type ApiResponse } from './http'
import type { PaginatedResult } from './types'

export interface Tag {
  id: string
  name: string
  color?: string | null
  sort: number
  siteCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface TagPayload {
  name: string
  color?: string
  sort?: number
}

export async function getTags(params?: { page?: number; pageSize?: number }) {
  const response = await http.get<ApiResponse<PaginatedResult<Tag>>>('/admin/tags', { params })
  return response.data.data || { items: [], total: 0, page: params?.page || 1, pageSize: params?.pageSize || 10 }
}

export async function getTagOptions() {
  const response = await http.get<ApiResponse<Tag[]>>('/admin/tags/options')
  return response.data.data || []
}

export async function createTag(payload: TagPayload) {
  const response = await http.post<ApiResponse<Tag>>('/admin/tags', payload)
  return response.data.data
}

export async function updateTag(id: string, payload: TagPayload) {
  const response = await http.put<ApiResponse<Tag>>(`/admin/tags/${id}`, payload)
  return response.data.data
}

export async function deleteTag(id: string) {
  const response = await http.delete<ApiResponse<boolean>>(`/admin/tags/${id}`)
  return response.data.data
}

export async function reorderTags(items: Array<{ id: string; sort: number }>) {
  const response = await http.post<ApiResponse<boolean>>('/admin/tags/reorder', { items })
  return response.data.data
}

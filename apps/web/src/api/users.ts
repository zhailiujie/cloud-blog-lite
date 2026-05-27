import { http, type ApiResponse } from './http'
import { normalizePaginatedResult, type PaginatedResult } from './types'

export type UserRole = 'admin' | 'editor' | 'viewer'

export interface User {
  id: string
  username: string
  nickname?: string | null
  avatar?: string | null
  role: UserRole
  status: number
  remark?: string | null
  loginErrorCount: number
  lastLoginAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateUserPayload {
  username: string
  password: string
  nickname?: string
  avatar?: string
  role: UserRole
  status: number
  remark?: string
}

export interface UpdateUserPayload {
  nickname?: string
  avatar?: string
  role: UserRole
  status: number
  remark?: string
}



export async function getUsers(params?: { page?: number; pageSize?: number }): Promise<PaginatedResult<User>> {
  const response = await http.get<ApiResponse<User[] | PaginatedResult<User>>>('/admin/users', { params })
  return normalizePaginatedResult(response.data.data, params?.page, params?.pageSize)
}

export async function createUser(payload: CreateUserPayload) {
  const response = await http.post<ApiResponse<User>>('/admin/users', payload)
  return response.data.data
}

export async function updateUser(id: string, payload: UpdateUserPayload) {
  const response = await http.put<ApiResponse<User>>(`/admin/users/${id}`, payload)
  return response.data.data
}

export async function resetUserPassword(id: string, password: string) {
  const response = await http.post<ApiResponse<boolean>>(`/admin/users/${id}/reset-password`, { password })
  return response.data.data
}

export async function deleteUser(id: string) {
  const response = await http.delete<ApiResponse<boolean>>(`/admin/users/${id}`)
  return response.data.data
}

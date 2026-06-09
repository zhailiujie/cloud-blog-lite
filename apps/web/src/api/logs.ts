import { http, type ApiResponse } from './http'
import { normalizePaginatedResult, type PaginatedResult } from './types'

export interface OperationLog {
  id: string
  userId?: string | null
  username?: string | null
  action: string
  module?: string | null
  description?: string | null
  detail?: string | null
  ip?: string | null
  userAgent?: string | null
  createdAt: string
}



export async function getOperationLogs(params?: { page?: number; pageSize?: number; module?: string; action?: string; username?: string; startAt?: string; endAt?: string }): Promise<PaginatedResult<OperationLog>> {
  const response = await http.get<ApiResponse<OperationLog[] | PaginatedResult<OperationLog>>>('/admin/operation-logs', { params })
  return normalizePaginatedResult(response.data.data, params?.page, params?.pageSize)
}

export async function cleanupOperationLogs(beforeDays = 90) {
  const response = await http.delete<ApiResponse<{ deleted: number; before: string }>>('/admin/operation-logs/cleanup', {
    params: { beforeDays },
  })
  return response.data.data
}

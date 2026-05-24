import { http } from './http'

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

interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

export async function getOperationLogs() {
  const response = await http.get<ApiResponse<OperationLog[]>>('/admin/operation-logs')
  return response.data.data || []
}

export async function cleanupOperationLogs(beforeDays = 90) {
  const response = await http.delete<ApiResponse<{ deleted: number; before: string }>>('/admin/operation-logs/cleanup', {
    params: { beforeDays },
  })
  return response.data.data
}

import { http, type ApiResponse } from './http'

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export function normalizePaginatedResult<T>(data: T[] | PaginatedResult<T> | null, page = 1, pageSize = 20): PaginatedResult<T> {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page,
      pageSize,
    }
  }

  return data || {
    items: [],
    total: 0,
    page,
    pageSize,
  }
}

export { http, type ApiResponse }

export interface PaginationParams {
  page: number
  pageSize: number
  offset: number
}

export function parsePagination(query: (name: string) => string | undefined): PaginationParams {
  const page = Math.max(1, Number(query('page') || 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query('pageSize') || 20) || 20))
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  }
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

export const API_SUCCESS_CODE = 0

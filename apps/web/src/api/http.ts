import axios from 'axios'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 15000,
  withCredentials: true,
})

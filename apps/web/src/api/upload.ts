import { http } from './http'

interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

export interface UploadResult {
  key: string
  url: string
}

export async function uploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  const response = await http.post<ApiResponse<UploadResult>>('/admin/upload', form)
  return response.data.data
}

import { http, type ApiResponse } from './http'



export type SettingsMap = Record<string, string>

export async function getSettings() {
  const response = await http.get<ApiResponse<SettingsMap>>('/admin/settings')
  return response.data.data || {}
}

export async function updateSettings(payload: SettingsMap) {
  const response = await http.put<ApiResponse<SettingsMap>>('/admin/settings', payload)
  return response.data.data || {}
}

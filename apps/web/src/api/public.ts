import { http } from './http'

export interface PublicSite {
  id: string
  categoryId: string
  name: string
  url: string
  description?: string | null
  logo?: string | null
  sort: number
}

export interface PublicCategory {
  id: string
  parentId: string
  name: string
  icon?: string | null
  sort: number
  level?: number | null
  sites: PublicSite[]
}

export interface NavigationData {
  settings: {
    title: string
    description: string
    logo?: string
    footerText?: string
  }
  categories: PublicCategory[]
}

interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

export async function getNavigation() {
  const response = await http.get<ApiResponse<NavigationData>>('/public/navigation')
  return response.data.data
}

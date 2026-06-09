import { http, type ApiResponse } from './http'

export interface PublicTag {
  id: string
  name: string
  color?: string | null
}

export interface PublicSite {
  id: string
  categoryId: string
  name: string
  url: string
  description?: string | null
  logo?: string | null
  sort: number
  isPinned: number
  clickCount: number
  tags?: PublicTag[]
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



export async function getNavigation() {
  const response = await http.get<ApiResponse<NavigationData>>('/public/navigation')
  return response.data.data
}

export async function trackSiteClick(id: string) {
  await http.post<ApiResponse<boolean>>(`/public/sites/${id}/click`)
}

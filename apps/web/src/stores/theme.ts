import { computed, ref } from 'vue'
import { darkTheme, lightTheme } from 'naive-ui'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'cloud_blog_theme'

function hasBrowserEnv() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function getInitialTheme(): ThemeMode {
  if (!hasBrowserEnv()) return 'light'

  const saved = localStorage.getItem(THEME_STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') {
    return saved
  }

  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(getInitialTheme())

  const naiveTheme = computed(() => (mode.value === 'dark' ? darkTheme : lightTheme))
  const isDark = computed(() => mode.value === 'dark')

  function applyTheme(persist = true) {
    if (!hasBrowserEnv()) return
    document.documentElement.dataset.theme = mode.value
    if (persist) {
      localStorage.setItem(THEME_STORAGE_KEY, mode.value)
    }
  }

  function setTheme(nextMode: ThemeMode) {
    mode.value = nextMode
    applyTheme()
  }

  function toggleTheme() {
    setTheme(mode.value === 'dark' ? 'light' : 'dark')
  }

  function setupSystemThemeListener() {
    if (!hasBrowserEnv()) return
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return

    media.addEventListener('change', (event) => {
      const saved = localStorage.getItem(THEME_STORAGE_KEY)
      if (saved === 'light' || saved === 'dark') return
      mode.value = event.matches ? 'dark' : 'light'
      applyTheme(false)
    })
  }

  applyTheme(false)
  setupSystemThemeListener()

  return {
    mode,
    naiveTheme,
    isDark,
    setTheme,
    toggleTheme,
  }
})

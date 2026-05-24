import { computed, ref } from 'vue'
import { darkTheme, lightTheme } from 'naive-ui'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'cloud_blog_theme'

function getInitialTheme(): ThemeMode {
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

  function applyTheme() {
    document.documentElement.dataset.theme = mode.value
    localStorage.setItem(THEME_STORAGE_KEY, mode.value)
  }

  function setTheme(nextMode: ThemeMode) {
    mode.value = nextMode
    applyTheme()
  }

  function toggleTheme() {
    setTheme(mode.value === 'dark' ? 'light' : 'dark')
  }

  applyTheme()

  return {
    mode,
    naiveTheme,
    isDark,
    setTheme,
    toggleTheme,
  }
})

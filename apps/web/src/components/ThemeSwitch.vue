<template>
  <n-button quaternary circle :title="title" @click="theme.toggleTheme">
    <template #icon>
      <span class="theme-icon">{{ theme.isDark ? '☀️' : '🌙' }}</span>
    </template>
  </n-button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
const title = computed(() => (theme.isDark ? '切换到白色主题' : '切换到暗黑主题'))
</script>

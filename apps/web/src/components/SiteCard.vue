<template>
  <a class="site-card" :href="safeUrl" target="_blank" rel="noopener noreferrer">
    <div class="site-logo" :class="{ 'has-logo': Boolean(logo) && !logoLoadFailed }">
      <img v-if="logo && !logoLoadFailed" :src="logo" :alt="name" @error="logoLoadFailed = true" />
      <span v-else>{{ firstChar }}</span>
    </div>
    <div class="site-main">
      <h3>{{ name }}</h3>
      <p>{{ description || '暂无描述' }}</p>
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  name: string
  url: string
  description?: string
  logo?: string
}>()

const logoLoadFailed = ref(false)

const safeUrl = computed(() => {
  const value = props.url.trim()
  return value.startsWith('http://') || value.startsWith('https://') ? value : '#'
})
const firstChar = computed(() => ([...props.name][0] || '').toUpperCase())

watch(() => props.logo, () => {
  logoLoadFailed.value = false
})
</script>

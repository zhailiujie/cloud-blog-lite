<template>
  <a class="site-card" :href="url" target="_blank" rel="noopener noreferrer">
    <div class="site-logo">
      <img v-if="logo" :src="logo" :alt="name" />
      <span v-else>{{ name.slice(0, 1).toUpperCase() }}</span>
    </div>
    <div class="site-main">
      <h3>{{ name }}</h3>
      <p>{{ description || '暂无描述' }}</p>
    </div>
  </a>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  url: string
  description?: string
  logo?: string
}>()
</script>

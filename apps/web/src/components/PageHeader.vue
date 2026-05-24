<template>
  <div class="page-header">
    <div>
      <p v-if="subtitle" class="page-subtitle">{{ subtitle }}</p>
      <h2>{{ title }}</h2>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

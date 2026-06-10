<template>
  <a ref="cardRef" class="site-card" :href="safeUrl" target="_blank" rel="noopener noreferrer" @click="handleClick">
    <div class="site-logo" :class="{ 'has-logo': shouldRenderLogo }">
      <img v-if="shouldRenderLogo" :src="logo" :alt="name" decoding="async" @error="logoLoadFailed = true" />
      <span v-else>{{ firstChar }}</span>
    </div>
    <div class="site-main">
      <span v-if="isPinned" class="site-badge">置顶</span>
      <h3>{{ name }}</h3>
      <p>{{ description || '暂无描述' }}</p>
      <div v-if="tags?.length" class="site-tags">
        <span v-for="tag in tags" :key="tag.id" class="site-tag" :style="{ '--tag-color': tag.color || 'var(--primary)' }" @click.prevent.stop="emit('tagClick', tag.id)">{{ tag.name }}</span>
      </div>
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { trackSiteClick } from '@/api/public'

const emit = defineEmits<{ tagClick: [id: string] }>()

const props = defineProps<{
  name: string
  siteId?: string
  url: string
  description?: string
  logo?: string
  isPinned?: boolean
  clickCount?: number
  tags?: Array<{ id: string; name: string; color?: string | null }>
}>()

const logoLoadFailed = ref(false)
const shouldLoadLogo = ref(false)
const cardRef = ref<HTMLElement | null>(null)
let logoObserver: IntersectionObserver | null = null

const safeUrl = computed(() => {
  const value = props.url.trim()
  return value.startsWith('http://') || value.startsWith('https://') ? value : '#'
})
const firstChar = computed(() => ([...props.name][0] || '').toUpperCase())
const shouldRenderLogo = computed(() => Boolean(props.logo) && shouldLoadLogo.value && !logoLoadFailed.value)

function observeLogo() {
  logoObserver?.disconnect()
  logoObserver = null

  if (!props.logo || !cardRef.value) return

  if (!('IntersectionObserver' in window)) {
    shouldLoadLogo.value = true
    return
  }

  logoObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return
      shouldLoadLogo.value = true
      logoObserver?.disconnect()
      logoObserver = null
    },
    { rootMargin: '80px 0px', threshold: 0.01 },
  )
  logoObserver.observe(cardRef.value)
}

function handleClick() {
  if (!props.siteId || safeUrl.value === '#') return
  trackSiteClick(props.siteId).catch(() => {})
}

watch(() => props.logo, () => {
  logoLoadFailed.value = false
  shouldLoadLogo.value = false
  observeLogo()
})

onMounted(observeLogo)

onUnmounted(() => {
  logoObserver?.disconnect()
})
</script>

<style scoped>
.site-main {
  min-width: 0;
}

.site-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  margin-bottom: 6px;
  border-radius: 999px;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary), transparent 88%);
  font-size: 11px;
  font-weight: 700;
}

.site-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

.site-tag {
  padding: 1px 6px;
  border-radius: 999px;
  color: var(--tag-color);
  background: color-mix(in srgb, var(--tag-color), transparent 88%);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
</style>

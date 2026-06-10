<template>
  <a ref="cardRef" class="site-card" :href="safeUrl" target="_blank" rel="noopener noreferrer" @click="handleClick">
    <span v-if="isPinned" class="site-pin-icon" aria-label="置顶">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.8 3.2 20.8 9.2 18.7 11.3 17.1 9.7 13.2 13.6 13.8 17.4 12.4 18.8 9.1 15.5 5.2 19.4 4.6 18.8 8.5 14.9 5.2 11.6 6.6 10.2 10.4 10.8 14.3 6.9 12.7 5.3 14.8 3.2Z" />
      </svg>
    </span>
    <div class="site-logo" :class="{ 'has-logo': shouldRenderLogo }">
      <img v-if="shouldRenderLogo" :src="logo" :alt="name" decoding="async" @error="logoLoadFailed = true" />
      <span v-else>{{ firstChar }}</span>
    </div>
    <div class="site-main">
      <div class="site-title-row">
        <h3>{{ name }}</h3>
      </div>
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
.site-card {
  position: relative;
}

.site-pin-icon {
  position: absolute;
  top: 9px;
  right: 10px;
  display: inline-grid;
  place-items: center;
  width: 19px;
  height: 19px;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary), transparent 86%);
}

.site-pin-icon svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}

.site-main {
  min-width: 0;
}

.site-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-bottom: 3px;
}

.site-title-row h3 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 7px;
}

.site-tag {
  padding: 1px 6px;
  border-radius: 999px;
  color: var(--tag-color);
  background: color-mix(in srgb, var(--tag-color), transparent 91%);
  font-size: 10px;
  line-height: 1.5;
  font-weight: 600;
  cursor: pointer;
}
</style>

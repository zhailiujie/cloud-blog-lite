<template>
  <main class="landing-page">
    <header class="landing-nav glass-panel">
      <div class="nav-brand">
        <img v-if="navigation?.settings.logo" class="brand-logo" :src="navigation.settings.logo" alt="logo" />
        <div v-else class="brand-mark">Y</div>
        <div>
          <strong>{{ navigation?.settings.title || 'cloud-blog-lite' }}</strong>
        </div>
      </div>
      <n-space align="center">
        <ThemeSwitch />
      </n-space>
    </header>

    <section class="landing-hero">
      <!--<h1>精选<span class="hero-accent">资源</span>，一键直达</h1>-->
      <!--<p>{{ navigation?.settings.description || '精选工具与资源，分类整理，一键直达。' }}</p>-->
      <div class="search-card glass-panel">
        <n-input ref="searchInputRef" v-model:value="keyword" size="large" round placeholder="搜索站点、工具或资源">
          <template #prefix>🔎</template>
        </n-input>
      </div>
      <div v-if="allTags.length" class="tag-filter glass-panel">
        <button class="tag-filter-item" :class="{ active: !selectedTagId }" @click="selectedTagId = ''">全部标签</button>
        <button
          v-for="tag in allTags"
          :key="tag.id"
          class="tag-filter-item"
          :class="{ active: selectedTagId === tag.id }"
          :style="{ '--tag-color': tag.color || 'var(--primary)' }"
          @click="selectedTagId = selectedTagId === tag.id ? '' : tag.id"
        >
          {{ tag.name }}
        </button>
      </div>
    </section>



    <section ref="contentShellRef" class="content-shell">
      <!-- 左侧分类导航 -->
      <aside class="category-panel glass-panel">
        <!-- 加载中：分类骨架屏 -->
        <template v-if="loading">
          <div v-for="i in 9" :key="i" class="cat-skeleton">
            <div class="skel skel-circle"></div>
            <div class="skel skel-bar" :style="{ width: (50 + (i % 4) * 18) + 'px' }"></div>
          </div>
        </template>
        <template v-else>
          <button
            v-for="category in categories"
            :key="category.id"
            class="category-item"
            :class="{ active: activeCategory === category.id }"
            @click="selectCategory(category.id)"
          >
            <span class="cat-icon">
              {{ isEmoji(category.icon) ? category.icon : firstChar(category.name) }}
            </span>
            <span class="cat-name">{{ category.name }}</span>
          </button>
        </template>
      </aside>

      <!-- 右侧：全量展示所有分类与站点 -->
      <section class="site-section">
        <div v-if="loading" class="site-grid">
          <div v-for="item in 12" :key="item" class="skel skel-card"></div>
        </div>
        <template v-else-if="filteredCategories.length">
          <div
            v-for="category in filteredCategories"
            :key="category.id"
            :data-cat-id="category.id"
            :ref="(el) => registerRef(category.id, el)"
            class="category-block"
          >
            <div class="section-title">
              <div>
                <h2>{{ category.name }}</h2>
              </div>
            </div>
            <div class="site-grid">
              <SiteCard
                v-for="site in category.sites"
                :key="site.id"
                :site-id="site.id"
                :name="site.name"
                :url="site.url"
                :description="site.description || ''"
                :logo="site.logo || ''"
                :is-pinned="site.isPinned === 1"
                :tags="site.tags || []"
                :click-count="site.clickCount || 0"
                @tag-click="selectedTagId = $event"
              />
            </div>
          </div>
        </template>
        <n-empty v-else description="没有找到匹配的站点" class="empty-state" />
      </section>
    </section>

    <footer class="landing-footer">{{ navigation?.settings.footerText || 'Powered by Cloudflare Pages + Workers' }}</footer>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import ThemeSwitch from '@/components/ThemeSwitch.vue'
import SiteCard from '@/components/SiteCard.vue'
import { getNavigation, type NavigationData, type PublicCategory } from '@/api/public'

const keyword = ref('')
const selectedTagId = ref('')
const searchInputRef = ref<{ focus?: () => void } | null>(null)
const activeCategory = ref('')
const loading = ref(true)
const navigation = ref<NavigationData | null>(null)
const contentShellRef = ref<HTMLElement | null>(null)

// 各分类区块的 DOM 引用，用于滚动定位
const sectionRefs: Record<string, HTMLElement> = {}
let scrollObserver: IntersectionObserver | null = null

const categories = computed(() => navigation.value?.categories || [])
const allTags = computed(() => {
  const map = new Map<string, { id: string; name: string; color?: string | null }>()
  for (const category of categories.value) {
    for (const site of category.sites) {
      for (const tag of site.tags || []) {
        map.set(tag.id, tag)
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
})


/** 按关键词过滤：仅保留有匹配站点的分类 */
const filteredCategories = computed((): PublicCategory[] => {
  const key = keyword.value.trim().toLowerCase()
  const tagId = selectedTagId.value
  if (!key && !tagId) return categories.value
  return categories.value
    .map((cat) => ({
      ...cat,
      sites: cat.sites.filter((site) => {
        const matchedKeyword = !key ||
          site.name.toLowerCase().includes(key) ||
          (site.description || '').toLowerCase().includes(key) ||
          (site.tags || []).some((tag) => tag.name.toLowerCase().includes(key))
        const matchedTag = !tagId || (site.tags || []).some((tag) => tag.id === tagId)
        return matchedKeyword && matchedTag
      }),
    }))
    .filter((cat) => cat.sites.length > 0)
})

/** 注册 / 注销各分类区块的 DOM ref */
function registerRef(id: string, el: unknown) {
  if (el) sectionRefs[id] = el as HTMLElement
  else delete sectionRefs[id]
}

/** 点击左侧分类：平滑滚动到对应区块 */
function selectCategory(id: string) {
  activeCategory.value = id
  const el = sectionRefs[id]
  if (!el) return
  const offset = el.getBoundingClientRect().top + window.scrollY - 96
  window.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
}

/** 滚动监听：区块进入视口上半部时自动高亮对应侧栏项 */
function setupScrollSpy() {
  scrollObserver?.disconnect()
  scrollObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = (entry.target as HTMLElement).dataset.catId
          if (id) activeCategory.value = id
        }
      }
    },
    // 视口顶部留 80px（导航栏高度），底部裁掉 55%，只关注上方区域
    { rootMargin: '-80px 0px -55% 0px', threshold: 0 },
  )
  Object.values(sectionRefs).forEach((el) => scrollObserver?.observe(el))
}

function firstChar(value: string): string {
  return [...value][0] || ''
}

/** 判断 icon 字段是否为 emoji（排除 FA class 名） */
function isEmoji(icon: string | null | undefined): boolean {
  if (!icon) return false
  if (icon.startsWith('fa') || icon.includes(' ')) return false
  return icon.length <= 4
}

watch(categories, (value) => {
  if (value.length) {
    if (!activeCategory.value) activeCategory.value = value[0].id
    nextTick(setupScrollSpy)
  }
})

function updatePageMeta(data: NavigationData | null) {
  const title = data?.settings.title || 'cloud-blog-lite'
  const description = data?.settings.description || '轻量导航站'
  document.title = title
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'description'
    document.head.appendChild(meta)
  }
  meta.content = description
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
  event.preventDefault()
  searchInputRef.value?.focus?.()
}

onMounted(async () => {
  loading.value = true
  try {
    navigation.value = await getNavigation()
    updatePageMeta(navigation.value)
    window.addEventListener('keydown', handleGlobalKeydown)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  scrollObserver?.disconnect()
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>


/* ── Hero ──────────────────────────────────────────────────── */
.landing-hero {
  margin-top: 48px;
  margin-bottom: 40px;
}

.landing-hero h1 {
  font-size: clamp(28px, 4vw, 50px);
  letter-spacing: -0.04em;
  margin-bottom: 12px;
}

.hero-accent {
  background: linear-gradient(120deg, var(--primary) 0%, #06b6d4 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.landing-hero p {
  font-size: 15px;
  margin-bottom: 22px;
}

.tag-filter {
  max-width: 760px;
  margin: 14px auto 0;
  padding: 8px;
  border-radius: 999px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.tag-filter-item {
  border: 0;
  padding: 7px 12px;
  border-radius: 999px;
  color: var(--tag-color, var(--muted));
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.tag-filter-item.active,
.tag-filter-item:hover {
  color: var(--tag-color, var(--primary));
  background: color-mix(in srgb, var(--tag-color, var(--primary)), transparent 86%);
}

.popular-section {
  max-width: 1180px;
  margin: 0 auto 24px;
  padding: 18px;
  border-radius: 24px;
}

.compact-title {
  margin-bottom: 12px;
}

/* ── 分类侧栏 ───────────────────────────────────────────────── */
.category-item {
  padding: 9px 12px;
  border-radius: 14px;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
}

.cat-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  background: color-mix(in srgb, var(--primary), transparent 85%);
  color: var(--primary);
  transition: background 0.18s, color 0.18s;
}

.category-item.active .cat-icon,
.category-item:hover .cat-icon {
  background: var(--primary);
  color: #fff;
}

.cat-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 右侧分类区块 ────────────────────────────────────────────── */
.category-block {
  margin-bottom: 52px;
}

.category-block:last-child {
  margin-bottom: 0;
}

.section-title p {
  font-size: 11px;
  letter-spacing: 0.1em;
}

.section-title h2 {
  font-size: 24px;
}

/* ── 骨架屏 ─────────────────────────────────────────────────── */

@keyframes skel-shine {
  0%   { opacity: 0.45; }
  50%  { opacity: 0.9; }
  100% { opacity: 0.45; }
}

.skel {
  background: var(--border);
  animation: skel-shine 1.4s ease-in-out infinite;
}

/* 分类面板占位行 */
.cat-skeleton {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
}

.skel-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skel-bar {
  height: 14px;
  border-radius: 7px;
}

/* 站点卡片占位块 */
.skel-card {
  height: 66px;
  border-radius: 16px;
}

/* ── 站点卡片紧凑化（:deep 覆盖全局样式）─────────────────────── */
.site-grid {
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 10px;
}

:deep(.site-card) {
  padding: 12px 14px;
  min-height: unset;
  gap: 10px;
  border-radius: 16px;
}

:deep(.site-logo) {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  font-size: 14px;
}

:deep(.site-main h3) {
  font-size: 13px;
  margin-bottom: 3px;
}

:deep(.site-main p) {
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 640px) {
  .landing-nav {
    align-items: flex-start;
    gap: 12px;
    flex-direction: column;
    border-radius: 18px;
  }

  .landing-nav :deep(.n-space) {
    width: 100%;
    justify-content: space-between;
  }

  .nav-brand {
    min-width: 0;
  }

  .landing-hero {
    margin-top: 36px;
    margin-bottom: 28px;
    text-align: left;
  }

  .landing-hero h1 {
    font-size: clamp(30px, 10vw, 42px);
    line-height: 1.08;
  }

  .landing-hero p {
    font-size: 14px;
    line-height: 1.7;
  }

  .search-card {
    max-width: none;
    border-radius: 18px;
    padding: 8px;
  }

  .content-shell {
    gap: 16px;
  }

  .category-panel {
    margin: 0 -16px;
    padding: 8px 16px;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    box-shadow: none;
    scrollbar-width: none;
  }

  .category-panel::-webkit-scrollbar {
    display: none;
  }

  .category-item {
    width: auto;
    flex: 0 0 auto;
    padding: 8px 10px;
  }

  .cat-icon {
    width: 28px;
    height: 28px;
  }

  .category-block {
    margin-bottom: 36px;
  }

  .section-title {
    margin-bottom: 12px;
  }

  .site-grid {
    grid-template-columns: 1fr;
  }

  :deep(.site-card) {
    padding: 12px;
  }
}
</style>

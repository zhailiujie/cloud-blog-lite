<template>
  <main class="landing-page">
    <header class="landing-nav glass-panel">
      <div class="nav-brand">
        <img v-if="navigation?.settings.logo" class="brand-logo" :src="navigation.settings.logo" alt="logo" />
        <div v-else class="brand-mark">Y</div>
        <div>
          <strong>{{ navigation?.settings.title || 'cloud-blog-lite' }}</strong>
          <span>Cloudflare 导航站</span>
        </div>
      </div>
      <n-space align="center">
        <n-button quaternary @click="$router.push('/login')">登录后台</n-button>
        <ThemeSwitch />
      </n-space>
    </header>

    <section class="landing-hero">
      <div class="hero-badge">轻量 · 无服务器 · 可绑定域名</div>
      <h1>把常用资源整理成一个漂亮的导航站</h1>
      <p>{{ navigation?.settings.description || '基于 Vue 3、Cloudflare Workers、D1 和 R2 构建。' }}</p>
      <div class="search-card glass-panel">
        <n-input v-model:value="keyword" size="large" round placeholder="搜索站点、工具或资源">
          <template #prefix>🔎</template>
        </n-input>
      </div>
    </section>

    <section class="content-shell">
      <aside class="category-panel glass-panel">
        <button
          v-for="category in categories"
          :key="category.id"
          class="category-item"
          :class="{ active: activeCategory === category.id }"
          @click="activeCategory = category.id"
        >
          <span>{{ category.icon || '📁' }}</span>
          {{ category.name }}
        </button>
      </aside>

      <section class="site-section">
        <div class="section-title">
          <div>
            <p>精选资源</p>
            <h2>{{ currentCategory?.name || '暂无分类' }}</h2>
          </div>
          <n-button secondary @click="$router.push('/admin')">管理站点</n-button>
        </div>

        <div v-if="loading" class="site-grid">
          <n-skeleton v-for="item in 6" :key="item" height="106px" round />
        </div>
        <div v-else-if="filteredSites.length" class="site-grid">
          <SiteCard
            v-for="site in filteredSites"
            :key="site.id"
            :name="site.name"
            :url="site.url"
            :description="site.description || ''"
            :logo="site.logo || ''"
          />
        </div>
        <n-empty v-else description="没有找到匹配的站点" class="empty-state" />
      </section>
    </section>

    <footer class="landing-footer">{{ navigation?.settings.footerText || 'Powered by Cloudflare Pages + Workers' }}</footer>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ThemeSwitch from '@/components/ThemeSwitch.vue'
import SiteCard from '@/components/SiteCard.vue'
import { getNavigation, type NavigationData } from '@/api/public'

const keyword = ref('')
const activeCategory = ref('')
const loading = ref(false)
const navigation = ref<NavigationData | null>(null)

const categories = computed(() => navigation.value?.categories || [])
const currentCategory = computed(() => categories.value.find((item) => item.id === activeCategory.value))
const filteredSites = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  const sites = currentCategory.value?.sites || []
  return sites.filter((site) => !key || site.name.toLowerCase().includes(key) || (site.description || '').toLowerCase().includes(key))
})

watch(categories, (value) => {
  if (!activeCategory.value && value.length) {
    activeCategory.value = value[0].id
  }
})

onMounted(async () => {
  loading.value = true
  try {
    navigation.value = await getNavigation()
  } finally {
    loading.value = false
  }
})
</script>

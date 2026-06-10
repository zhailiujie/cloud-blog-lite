<template>
  <PageHeader title="点击统计" subtitle="Click Analytics">
    <n-button @click="loadStats">刷新</n-button>
  </PageHeader>

  <div class="stats-grid">
    <n-card title="总点击量" :loading="loading">
      <strong class="stat-number">{{ stats?.summary.totalClicks || 0 }}</strong>
    </n-card>
    <n-card title="有点击记录的站点" :loading="loading">
      <strong class="stat-number success">{{ stats?.summary.sitesWithClicks || 0 }}</strong>
    </n-card>
  </div>

  <n-card v-if="stats?.categoryStats.length" title="分类点击分布" class="mt-16">
    <div class="category-stats">
      <button
        v-for="item in stats.categoryStats"
        :key="item.id"
        class="category-stat-item"
        :class="{ active: query.categoryId === item.id }"
        @click="toggleCategoryFilter(item.id)"
      >
        <strong>{{ item.name }}</strong>
        <span>{{ item.clickCount }} 次 · {{ item.siteCount }} 个站点</span>
      </button>
    </div>
  </n-card>

  <n-card class="mt-16 filter-card">
    <n-space align="center">
      <n-input v-model:value="query.keyword" clearable placeholder="搜索站点名称、描述或 URL" class="filter-input" />
      <n-select
        v-model:value="query.categoryId"
        clearable
        filterable
        placeholder="选择分类"
        :options="categoryOptions"
        class="filter-select"
      />
    </n-space>
  </n-card>

  <n-card class="mt-16">
    <n-data-table
      :columns="columns"
      :data="stats?.items || []"
      :loading="loading"
      :pagination="pagination"
      remote
      :scroll-x="860"
      @update:page="handlePageChange"
      @update:page-size="handlePageSizeChange"
    />
  </n-card>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { NButton, NCard, NDataTable, NInput, NSelect, NSpace, useMessage, type DataTableColumns } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import { getCategoryOptions, type Category } from '@/api/categories'
import { getClickStats, type ClickStatsResult } from '@/api/dashboard'

const message = useMessage()
const loading = ref(false)
const stats = ref<ClickStatsResult | null>(null)
const categories = ref<Category[]>([])
const query = reactive({ keyword: '', categoryId: null as string | null })

const categoryOptions = computed(() => categories.value.map((item) => ({ label: item.name, value: item.id })))

const pagination = reactive({
  page: 1,
  pageSize: 20,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
})

function safeUrl(value: string) {
  const url = value.trim()
  return url.startsWith('http://') || url.startsWith('https://') ? url : '#'
}

const columns: DataTableColumns<NonNullable<ClickStatsResult['items']>[number]> = [
  { title: '站点', key: 'name', minWidth: 160 },
  { title: '分类', key: 'categoryName', width: 120, render(row) { return row.categoryName || '未分类' } },
  {
    title: 'URL',
    key: 'url',
    minWidth: 220,
    render(row) {
      return h('a', { href: safeUrl(row.url), target: '_blank', rel: 'noopener noreferrer' }, row.url)
    },
  },
  { title: '点击量', key: 'clickCount', width: 100 },
  {
    title: '最近点击',
    key: 'lastClickedAt',
    width: 180,
    render(row) { return row.lastClickedAt || '-' },
  },
]

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => ({ keyword: query.keyword, categoryId: query.categoryId }),
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      pagination.page = 1
      void loadStats()
    }, 300)
  },
)

async function loadCategories() {
  try {
    categories.value = await getCategoryOptions()
  } catch {
    message.error('分类加载失败')
  }
}

async function loadStats() {
  loading.value = true
  try {
    stats.value = await getClickStats({
      keyword: query.keyword || undefined,
      categoryId: query.categoryId || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    pagination.itemCount = stats.value?.total || 0
    pagination.page = stats.value?.page || pagination.page
    pagination.pageSize = stats.value?.pageSize || pagination.pageSize
  } catch {
    message.error('加载失败，请刷新重试')
  } finally {
    loading.value = false
  }
}

function toggleCategoryFilter(categoryId: string) {
  query.categoryId = query.categoryId === categoryId ? null : categoryId
}

function handlePageChange(page: number) {
  pagination.page = page
  void loadStats()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.page = 1
  void loadStats()
}

onMounted(async () => {
  await loadCategories()
  await loadStats()
})
</script>

<style scoped>
.category-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.category-stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 160px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-color);
  text-align: left;
  cursor: pointer;
}

.category-stat-item.active {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary-color) 35%, transparent);
}

.category-stat-item span {
  color: var(--text-color-3);
  font-size: 12px;
}
</style>

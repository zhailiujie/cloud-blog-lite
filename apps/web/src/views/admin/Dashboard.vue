<template>
  <PageHeader title="仪表盘" subtitle="Overview">
    <n-button type="primary" @click="$router.push('/admin/sites')">新增站点</n-button>
  </PageHeader>

  <div class="stats-grid">
    <n-card title="分类数量" :loading="loading"><strong class="stat-number">{{ stats?.counts.categories || 0 }}</strong></n-card>
    <n-card title="站点数量" :loading="loading"><strong class="stat-number">{{ stats?.counts.sites || 0 }}</strong></n-card>
    <n-card title="可见站点" :loading="loading"><strong class="stat-number success">{{ stats?.counts.visibleSites || 0 }}</strong></n-card>
    <n-card title="用户数量" :loading="loading"><strong class="stat-number">{{ stats?.counts.users || 0 }}</strong></n-card>
    <n-card title="日志数量" :loading="loading"><strong class="stat-number">{{ stats?.counts.logs || 0 }}</strong></n-card>
  </div>

  <div class="dashboard-grid mt-16">
    <n-card title="最近站点" :loading="loading">
      <n-empty v-if="!stats?.recentSites.length" description="暂无站点" />
      <div v-else class="compact-list">
        <a v-for="site in stats.recentSites" :key="site.id" :href="site.url" target="_blank" rel="noreferrer">
          <span>{{ site.name }}</span>
          <small>{{ site.category_name || '未分类' }}</small>
        </a>
      </div>
    </n-card>

    <n-card title="最近操作" :loading="loading">
      <n-empty v-if="!stats?.recentLogs.length" description="暂无日志" />
      <div v-else class="compact-list">
        <div v-for="log in stats.recentLogs" :key="log.id">
          <span>{{ log.description || log.action }}</span>
          <small>{{ log.username || 'system' }} · {{ log.created_at }}</small>
        </div>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { getDashboardStats, type DashboardStats } from '@/api/dashboard'

const loading = ref(false)
const stats = ref<DashboardStats | null>(null)

async function loadStats() {
  loading.value = true
  try {
    stats.value = await getDashboardStats()
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

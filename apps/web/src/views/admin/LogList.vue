<template>
  <PageHeader title="操作日志" subtitle="Operation Logs">
    <n-button @click="handleCleanup">清理 7 天前日志</n-button>
  </PageHeader>
  <n-card class="mb-16 filter-card">
    <n-space align="center">
      <n-select filterable v-model:value="query.module" clearable placeholder="模块" :options="moduleOptions" class="filter-select" />
      <n-select filterable v-model:value="query.action" clearable placeholder="操作" :options="actionOptions" class="filter-select" />
      <n-input v-model:value="query.username" clearable placeholder="用户名" class="filter-input" />
      <n-button @click="handleSearch">查询</n-button>
    </n-space>
  </n-card>

  <n-card>
    <n-data-table
      class="desktop-table"
      :columns="columns"
      :data="logs"
      :loading="loading"
      :pagination="pagination"
      remote
      :scroll-x="900"
    />
    <div class="mobile-card-list">
      <div v-for="log in logs" :key="log.id" class="mobile-data-card">
        <div class="mobile-card-head">
          <div>
            <strong>{{ log.description || log.action }}</strong>
            <small>{{ log.createdAt }}</small>
          </div>
          <n-tag type="info" :bordered="false">{{ log.action }}</n-tag>
        </div>
        <div class="mobile-card-row"><span>用户</span><b>{{ log.username || 'system' }}</b></div>
        <div class="mobile-card-row"><span>模块</span><b>{{ log.module || '-' }}</b></div>
        <div class="mobile-card-row"><span>IP</span><b>{{ log.ip || '-' }}</b></div>
      </div>
    </div>
  </n-card>

  <n-modal v-model:show="showDetail" preset="card" title="日志详情" class="form-modal large">
    <n-descriptions v-if="selectedLog" label-placement="left" bordered :column="1">
      <n-descriptions-item label="时间">{{ selectedLog.createdAt }}</n-descriptions-item>
      <n-descriptions-item label="用户">{{ selectedLog.username || 'system' }}</n-descriptions-item>
      <n-descriptions-item label="模块">{{ selectedLog.module || '-' }}</n-descriptions-item>
      <n-descriptions-item label="操作">{{ selectedLog.action }}</n-descriptions-item>
      <n-descriptions-item label="描述">{{ selectedLog.description || '-' }}</n-descriptions-item>
      <n-descriptions-item label="IP">{{ selectedLog.ip || '-' }}</n-descriptions-item>
      <n-descriptions-item label="详情"><pre class="detail-json">{{ formatDetail(selectedLog.detail) }}</pre></n-descriptions-item>
    </n-descriptions>
  </n-modal>
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { NButton, NTag, NSpace, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import { cleanupOperationLogs, getOperationLogs, type OperationLog } from '@/api/logs'

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const logs = ref<OperationLog[]>([])
const showDetail = ref(false)
const selectedLog = ref<OperationLog | null>(null)
const query = reactive({ module: null as string | null, action: null as string | null, username: '' })
const moduleOptions = ['site', 'tag', 'user', 'setting', 'operation-log'].map((value) => ({ label: value, value }))
const actionOptions = ['create', 'update', 'delete', 'import', 'export', 'check', 'check-all', 'cleanup'].map((value) => ({ label: value, value }))
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onUpdatePage(page: number) {
    pagination.page = page
    void loadLogs()
  },
  onUpdatePageSize(pageSize: number) {
    pagination.pageSize = pageSize
    pagination.page = 1
    void loadLogs()
  },
})

const columns: DataTableColumns<OperationLog> = [
  { title: '时间', key: 'createdAt', width: 190 },
  { title: '用户', key: 'username', width: 120 },
  {
    title: '操作',
    key: 'action',
    width: 150,
    render(row) {
      return h(NTag, { type: 'info', bordered: false }, { default: () => row.action })
    },
  },
  { title: '模块', key: 'module', width: 120 },
  { title: '描述', key: 'description', minWidth: 180 },
  { title: 'IP', key: 'ip', width: 140 },
  { title: '操作', key: 'actions', width: 90, render(row) { return h(NButton, { size: 'small', onClick: () => openDetail(row) }, { default: () => '详情' }) } },
]

async function loadLogs() {
  loading.value = true
  try {
    const result = await getOperationLogs({ page: pagination.page, pageSize: pagination.pageSize, module: query.module || undefined, action: query.action || undefined, username: query.username || undefined })
    logs.value = result.items
    pagination.itemCount = result.total
  } catch {
    message.error('加载失败，请刷新重试')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  void loadLogs()
}

function openDetail(log: OperationLog) {
  selectedLog.value = log
  showDetail.value = true
}

function formatDetail(detail?: string | null) {
  if (!detail) return '-'
  try {
    return JSON.stringify(JSON.parse(detail), null, 2)
  } catch {
    return detail
  }
}

function handleCleanup() {
  dialog.warning({
    title: '确认清理日志',
    content: '确定清理 7 天前的操作日志吗？该操作不可恢复。',
    positiveText: '清理',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await cleanupOperationLogs(7)
        message.success(`已清理 ${result?.deleted || 0} 条日志`)
        await loadLogs()
      } catch {
        message.error('清理失败')
      }
    },
  })
}

onMounted(loadLogs)
</script>

<style scoped>
.detail-json { white-space: pre-wrap; word-break: break-word; margin: 0; }
</style>

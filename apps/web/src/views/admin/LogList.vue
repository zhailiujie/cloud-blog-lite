<template>
  <PageHeader title="操作日志" subtitle="Operation Logs">
    <n-button @click="handleCleanup">清理 90 天前日志</n-button>
  </PageHeader>
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
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { NTag, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import { cleanupOperationLogs, getOperationLogs, type OperationLog } from '@/api/logs'

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const logs = ref<OperationLog[]>([])
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
]

async function loadLogs() {
  loading.value = true
  try {
    const result = await getOperationLogs({ page: pagination.page, pageSize: pagination.pageSize })
    logs.value = result.items
    pagination.itemCount = result.total
  } catch {
    message.error('加载失败，请刷新重试')
  } finally {
    loading.value = false
  }
}

function handleCleanup() {
  dialog.warning({
    title: '确认清理日志',
    content: '确定清理 90 天前的操作日志吗？该操作不可恢复。',
    positiveText: '清理',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const result = await cleanupOperationLogs(90)
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

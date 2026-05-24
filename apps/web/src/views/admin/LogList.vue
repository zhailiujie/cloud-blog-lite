<template>
  <PageHeader title="操作日志" subtitle="Operation Logs">
    <n-button @click="handleCleanup">清理 90 天前日志</n-button>
  </PageHeader>
  <n-card>
    <n-data-table :columns="columns" :data="logs" :loading="loading" :pagination="{ pageSize: 10 }" />
  </n-card>
</template>

<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import { NTag, useMessage, type DataTableColumns } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import { cleanupOperationLogs, getOperationLogs, type OperationLog } from '@/api/logs'

const message = useMessage()
const loading = ref(false)
const logs = ref<OperationLog[]>([])

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
    logs.value = await getOperationLogs()
  } finally {
    loading.value = false
  }
}

async function handleCleanup() {
  const result = await cleanupOperationLogs(90)
  message.success(`已清理 ${result?.deleted || 0} 条日志`)
  await loadLogs()
}

onMounted(loadLogs)
</script>

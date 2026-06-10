<template>
  <PageHeader title="标签管理" subtitle="Tags">
    <n-space>
      <n-button v-if="canEdit" @click="openSortModal">调整排序</n-button>
      <n-button v-if="canEdit" type="primary" @click="openCreate">新增标签</n-button>
    </n-space>
  </PageHeader>

  <n-card>
    <n-data-table
      class="desktop-table"
      :columns="columns"
      :data="tags"
      :loading="loading"
      :pagination="pagination"
      :row-key="rowKey"
      remote
      @update:page="handlePageChange"
      @update:page-size="handlePageSizeChange"
    />
    <div class="mobile-card-list">
      <div v-for="tag in tags" :key="tag.id" class="mobile-data-card">
        <div class="mobile-card-head">
          <div>
            <strong>{{ tag.name }}</strong>
            <small>站点数：{{ tag.siteCount || 0 }}</small>
          </div>
          <span class="tag-color" :style="{ background: tag.color || 'var(--primary)' }"></span>
        </div>
        <div class="mobile-card-row">
          <span>排序</span>
          <b>{{ tag.sort }}</b>
        </div>
        <n-space v-if="canEdit" justify="end">
          <n-button size="small" @click="openEdit(tag)">编辑</n-button>
          <n-button size="small" type="error" ghost @click="confirmDelete(tag)">删除</n-button>
        </n-space>
      </div>
    </div>
  </n-card>

  <n-modal v-model:show="showModal" preset="card" :title="editingId ? '编辑标签' : '新增标签'" class="form-modal">
    <n-form label-placement="top">
      <n-form-item label="标签名称" required>
        <n-input v-model:value="form.name" placeholder="请输入标签名称" />
      </n-form-item>
      <n-grid :cols="2" :x-gap="12">
        <n-form-item-gi label="颜色">
          <n-color-picker v-model:value="form.color" :show-alpha="false" />
        </n-form-item-gi>
        <n-form-item-gi label="排序">
          <n-input-number v-model:value="form.sort" class="full-width" />
        </n-form-item-gi>
      </n-grid>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showModal = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <DragSortModal
    v-if="canEdit"
    v-model:show="showSortModal"
    title="调整标签排序"
    :items="sortItems"
    :saving="sortSaving"
    @save="handleSortSave"
  />
</template>

<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { NButton, NCard, NColorPicker, NDataTable, NForm, NFormItem, NFormItemGi, NGrid, NInput, NInputNumber, NModal, NSpace, useDialog, useMessage, type DataTableColumns, type PaginationProps } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import DragSortModal from '@/components/DragSortModal.vue'
import { usePermissions } from '@/composables/usePermissions'
import { createTag, deleteTag, getTagOptions, getTags, reorderTags, updateTag, type Tag, type TagPayload } from '@/api/tags'
import { buildReorderPayload } from '@/utils/reorder'

const message = useMessage()
const dialog = useDialog()
const { canEdit } = usePermissions()
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const showSortModal = ref(false)
const sortSaving = ref(false)
const editingId = ref<string | null>(null)
const tags = ref<Tag[]>([])
const sortItems = ref<Array<{ id: string; label: string; meta?: string }>>([])
const form = reactive<TagPayload>({ name: '', color: '#4f46e5', sort: 0 })
const pagination = reactive<PaginationProps>({ page: 1, pageSize: 10, itemCount: 0, showSizePicker: true, pageSizes: [10, 20, 50] })
const rowKey = (row: Tag) => row.id

const columns: DataTableColumns<Tag> = [
  { title: '名称', key: 'name', minWidth: 140, render(row) { return renderTag(row) } },
  { title: '站点数', key: 'siteCount', width: 90 },
  { title: '排序', key: 'sort', width: 90 },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right',
    render(row) {
      if (!canEdit.value) return '只读'
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
          h(NButton, { size: 'small', type: 'error', ghost: true, onClick: () => confirmDelete(row) }, { default: () => '删除' }),
        ],
      })
    },
  },
]

function renderTag(row: Tag) {
  return h(NSpace, { align: 'center', size: 8 }, {
    default: () => [
      h('span', { class: 'tag-color', style: { background: row.color || 'var(--primary)' } }),
      h('span', row.name),
    ],
  })
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.color = '#4f46e5'
  form.sort = 0
}

function openCreate() {
  resetForm()
  showModal.value = true
}

function openEdit(row: Tag) {
  editingId.value = row.id
  form.name = row.name
  form.color = row.color || '#4f46e5'
  form.sort = row.sort
  showModal.value = true
}

async function loadTags() {
  loading.value = true
  try {
    const result = await getTags({ page: Number(pagination.page || 1), pageSize: Number(pagination.pageSize || 10) })
    tags.value = result.items
    pagination.itemCount = result.total
    pagination.page = result.page
    pagination.pageSize = result.pageSize
  } catch {
    message.error('标签加载失败，请刷新重试')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (!form.name?.trim()) {
    message.warning('请输入标签名称')
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateTag(editingId.value, form)
      message.success('标签已更新')
    } else {
      await createTag(form)
      message.success('标签已创建')
    }
    showModal.value = false
    await loadTags()
  } catch {
    message.error('保存失败，请检查表单内容')
  } finally {
    saving.value = false
  }
}

function confirmDelete(row: Tag) {
  const dialogInstance = dialog.warning({
    title: '确认删除',
    content: `确定删除标签「${row.name}」吗？已被站点使用的标签不能删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      dialogInstance.loading = true
      try {
        await deleteTag(row.id)
        message.success('标签已删除')
        await loadTags()
      } catch {
        message.error('删除失败，标签可能仍被站点使用')
      } finally {
        dialogInstance.loading = false
      }
    },
  })
}

function handlePageChange(page: number) {
  pagination.page = page
  loadTags()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.page = 1
  loadTags()
}

async function openSortModal() {
  try {
    const items = await getTagOptions()
    sortItems.value = [...items]
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
      .map((item) => ({ id: item.id, label: item.name, meta: `${item.siteCount || 0} 个站点` }))
    showSortModal.value = true
  } catch {
    message.error('加载排序列表失败')
  }
}

async function handleSortSave(items: Array<{ id: string }>) {
  sortSaving.value = true
  try {
    await reorderTags(buildReorderPayload(items))
    message.success('排序已保存')
    showSortModal.value = false
    await loadTags()
  } catch {
    message.error('排序保存失败')
  } finally {
    sortSaving.value = false
  }
}

onMounted(loadTags)
</script>

<style scoped>
.tag-color {
  display: inline-block;
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  border-radius: 999px;
}
</style>

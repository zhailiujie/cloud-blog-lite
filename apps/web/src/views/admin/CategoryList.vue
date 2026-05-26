<template>
  <PageHeader title="分类管理" subtitle="Categories">
    <n-button type="primary" @click="openCreate">新增分类</n-button>
  </PageHeader>

  <n-card>
    <n-data-table class="desktop-table" :columns="columns" :data="categories" :loading="loading" :pagination="{ pageSize: 10 }" :scroll-x="760" />
    <div class="mobile-card-list">
      <div v-for="category in categories" :key="category.id" class="mobile-data-card">
        <div class="mobile-card-head">
          <div>
            <strong>{{ category.name }}</strong>
            <small>{{ category.icon || '无图标' }}</small>
          </div>
          <n-switch :value="category.visible === 1" disabled />
        </div>
        <div class="mobile-card-row"><span>父级</span><b>{{ category.parentId }}</b></div>
        <div class="mobile-card-row"><span>排序</span><b>{{ category.sort }}</b></div>
        <div class="mobile-card-row"><span>层级</span><b>{{ category.level }}</b></div>
        <n-space justify="end">
          <n-button size="small" @click="openEdit(category)">编辑</n-button>
          <n-button size="small" type="error" ghost @click="confirmDelete(category)">删除</n-button>
        </n-space>
      </div>
    </div>
  </n-card>

  <n-modal v-model:show="showModal" preset="card" :title="editingId ? '编辑分类' : '新增分类'" class="form-modal">
    <n-form label-placement="top">
      <n-form-item label="分类名称" required>
        <n-input v-model:value="form.name" placeholder="请输入分类名称" />
      </n-form-item>
      <n-form-item label="父级分类 ID">
        <n-input v-model:value="form.parentId" placeholder="0 表示顶级分类" />
      </n-form-item>
      <n-form-item label="图标">
        <n-input v-model:value="form.icon" placeholder="例如 💻 或 fa fa-code" />
      </n-form-item>
      <n-grid :cols="2" :x-gap="12">
        <n-form-item-gi label="排序">
          <n-input-number v-model:value="form.sort" class="full-width" />
        </n-form-item-gi>
        <n-form-item-gi label="层级">
          <n-input-number v-model:value="form.level" class="full-width" />
        </n-form-item-gi>
      </n-grid>
      <n-form-item label="是否显示">
        <n-switch v-model:value="visibleChecked" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showModal = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NSpace, NSwitch, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import { createCategory, deleteCategory, getCategories, updateCategory, type Category, type CategoryPayload } from '@/api/categories'

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const editingId = ref<string | null>(null)
const categories = ref<Category[]>([])
const form = reactive<CategoryPayload>({
  parentId: '0',
  name: '',
  icon: '',
  sort: 0,
  level: 1,
  visible: 1,
})

const visibleChecked = computed({
  get: () => form.visible !== 0,
  set: (value: boolean) => {
    form.visible = value ? 1 : 0
  },
})

const columns: DataTableColumns<Category> = [
  { title: '名称', key: 'name' },
  { title: '图标', key: 'icon', width: 100 },
  { title: '父级', key: 'parentId', width: 160 },
  { title: '排序', key: 'sort', width: 90 },
  { title: '层级', key: 'level', width: 90 },
  {
    title: '显示',
    key: 'visible',
    width: 90,
    render(row) {
      return h(NSwitch, { value: row.visible === 1, disabled: true })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 170,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
          h(NButton, { size: 'small', type: 'error', ghost: true, onClick: () => confirmDelete(row) }, { default: () => '删除' }),
        ],
      })
    },
  },
]

function resetForm() {
  editingId.value = null
  form.parentId = '0'
  form.name = ''
  form.icon = ''
  form.sort = 0
  form.level = 1
  form.visible = 1
}

function openCreate() {
  resetForm()
  showModal.value = true
}

function openEdit(row: Category) {
  editingId.value = row.id
  form.parentId = row.parentId
  form.name = row.name
  form.icon = row.icon || ''
  form.sort = row.sort
  form.level = row.level || 1
  form.visible = row.visible
  showModal.value = true
}

async function loadCategories() {
  loading.value = true
  try {
    categories.value = await getCategories()
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (!form.name?.trim()) {
    message.warning('请输入分类名称')
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateCategory(editingId.value, form)
      message.success('分类已更新')
    } else {
      await createCategory(form)
      message.success('分类已创建')
    }
    showModal.value = false
    await loadCategories()
  } catch (error) {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

function confirmDelete(row: Category) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除分类「${row.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await deleteCategory(row.id)
      message.success('分类已删除')
      await loadCategories()
    },
  })
}

onMounted(loadCategories)
</script>

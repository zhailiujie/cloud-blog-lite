<template>
  <PageHeader title="站点管理" subtitle="Sites">
    <n-space>
      <n-button v-if="canEdit" @click="handleExportSites">导出</n-button>
      <n-button v-if="canEdit" @click="triggerImport">导入</n-button>
      <n-button v-if="canEdit" @click="openSortModal">调整排序</n-button>
      <n-button v-if="canEdit" type="primary" @click="openCreate">新增站点</n-button>
    </n-space>
  </PageHeader>
  <input ref="importInput" type="file" accept="application/json,.json" class="hidden-file-input" @change="handleImportFile" />

  <n-card class="mb-16 filter-card">
    <n-space align="center">
      <n-input v-model:value="query.keyword" clearable placeholder="搜索站点名称、描述或 URL" class="filter-input" />
      <n-select filterable v-model:value="query.categoryId" clearable placeholder="选择分类" :options="categoryOptions" class="filter-select" />
      <n-select filterable v-model:value="query.tagId" clearable placeholder="选择标签" :options="tagOptions" class="filter-select" />

      <n-select filterable v-model:value="query.visible" clearable placeholder="显示状态" :options="visibleOptions" class="filter-select" />
      <n-select filterable v-model:value="query.isPinned" clearable placeholder="置顶状态" :options="pinnedOptions" class="filter-select" />
    </n-space>
  </n-card>

  <n-card>
    <n-data-table
      class="desktop-table"
      :columns="columns"
      :data="sites"
      :loading="loading"
      :pagination="pagination"
      remote
      :scroll-x="1040"
      @update:page="handlePageChange"
      @update:page-size="handlePageSizeChange"
    />
    <div class="mobile-card-list">
      <div v-for="site in sites" :key="site.id" class="mobile-data-card">
        <div class="mobile-card-head">
          <div>
            <strong>{{ site.name }}</strong>
            <small>{{ site.categoryName || '未分类' }}</small>
          </div>
          <n-switch :value="site.visible === 1" disabled />
        </div>
        <div class="mobile-card-row">
          <span>URL</span>
          <a :href="safeUrl(site.url)" target="_blank" rel="noopener noreferrer">{{ formatDisplayUrl(site.url) }}</a>
        </div>

        <div class="mobile-card-row">
          <span>置顶</span>
          <b>{{ site.isPinned === 1 ? '是' : '否' }}</b>
        </div>
        <div class="mobile-card-row">
          <span>点击</span>
          <b>{{ site.clickCount }}</b>
        </div>

        <div class="mobile-card-row">
          <span>排序</span>
          <b>{{ site.sort }}</b>
        </div>
        <n-space justify="end">
          <n-button size="small" @click="openDetail(site)">查看</n-button>
          <template v-if="canEdit">
            <n-button size="small" @click="openEdit(site)">编辑</n-button>
            <n-button size="small" type="error" ghost @click="confirmDelete(site)">删除</n-button>
          </template>
        </n-space>
      </div>
    </div>
  </n-card>

  <n-modal v-model:show="showModal" preset="card" :title="editingId ? '编辑站点' : '新增站点'" class="form-modal large">
    <n-form label-placement="top">
      <n-form-item label="所属分类" required>
        <n-select filterable v-model:value="form.categoryId" :options="categoryOptions" placeholder="请选择分类" />
      </n-form-item>
      <n-form-item label="标签">
        <n-select v-model:value="form.tagIds" multiple clearable filterable :options="tagOptions" placeholder="请选择标签" />
      </n-form-item>
      <n-form-item label="站点名称" required>
        <n-input v-model:value="form.name" placeholder="请输入站点名称" />
      </n-form-item>
      <n-form-item label="站点 URL" required>
        <n-input v-model:value="form.url" placeholder="https://example.com" />
      </n-form-item>
      <n-form-item label="Logo 地址">
        <n-input-group class="logo-input-group">
          <n-input v-model:value="form.logo" placeholder="可填写图片 URL、自动获取 favicon 或上传图片" />
          <n-button :loading="fetchingFavicon" @click="handleFetchFavicon">自动获取 favicon</n-button>
          <n-upload :show-file-list="false" :custom-request="handleLogoUpload">
            <n-button>上传</n-button>
          </n-upload>
          <n-button @click="form.logo = ''">清空</n-button>
        </n-input-group>
      </n-form-item>
      <n-grid :cols="2" :x-gap="12">
        <n-form-item-gi label="登录账号">
          <n-input v-model:value="form.account" placeholder="仅后台可见，可复制" />
        </n-form-item-gi>
        <n-form-item-gi label="登录密码">
          <n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="加密保存，后台可查看" />
        </n-form-item-gi>
      </n-grid>
      <n-form-item label="描述">
        <n-input v-model:value="form.description" type="textarea" placeholder="请输入站点描述" />
      </n-form-item>
      <n-grid :cols="3" :x-gap="12">
        <n-form-item-gi label="排序">
          <n-input-number v-model:value="form.sort" class="full-width" />
        </n-form-item-gi>
        <n-form-item-gi label="是否置顶">
          <n-switch v-model:value="pinnedChecked" />
        </n-form-item-gi>
        <n-form-item-gi label="是否显示">
          <n-switch v-model:value="visibleChecked" />
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

  <n-modal v-model:show="showDetailModal" preset="card" title="站点详情" class="form-modal large">
    <n-descriptions v-if="selectedSite" label-placement="left" bordered :column="1">
      <n-descriptions-item label="名称">{{ selectedSite.name }}</n-descriptions-item>
      <n-descriptions-item label="分类">{{ selectedSite.categoryName || '未分类' }}</n-descriptions-item>
      <n-descriptions-item label="URL">
        <a :href="safeUrl(selectedSite.url)" target="_blank" rel="noopener noreferrer">{{ selectedSite.url }}</a>
      </n-descriptions-item>
      <n-descriptions-item label="账号">
        <div class="detail-secret-line">
          <span>{{ selectedSite.account || '-' }}</span>
          <n-button v-if="selectedSite.account" size="tiny" quaternary circle title="复制" @click="copyText(selectedSite.account)">
            <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </n-button>
        </div>
      </n-descriptions-item>
      <n-descriptions-item label="密码">
        <div class="detail-secret-line">
          <span>{{ selectedSite.password || '-' }}</span>
          <n-button v-if="selectedSite.password" size="tiny" quaternary circle title="复制" @click="copyText(selectedSite.password)">
            <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </n-button>
        </div>
      </n-descriptions-item>
      <n-descriptions-item label="描述">{{ selectedSite.description || '-' }}</n-descriptions-item>
    </n-descriptions>
  </n-modal>

  <DragSortModal
    v-if="canEdit"
    v-model:show="showSortModal"
    title="调整站点排序"
    :items="sortItems"
    :saving="sortSaving"
    @save="handleSortSave"
  />
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue'
import { NButton, NCard, NDataTable, NDescriptions, NDescriptionsItem, NForm, NFormItem, NFormItemGi, NGrid, NInput, NInputGroup, NInputNumber, NModal, NSelect, NSpace, NSwitch, NUpload, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import DragSortModal from '@/components/DragSortModal.vue'
import { usePermissions } from '@/composables/usePermissions'
import { getCategoryOptions, type Category } from '@/api/categories'
import { createSite, deleteSite, exportSiteData, getSites, importSiteData, reorderSites, updateSite, type Site, type SitePayload } from '@/api/sites'
import { fetchFaviconToR2, uploadFile } from '@/api/upload'
import { getSettings } from '@/api/settings'
import { getTagOptions, type Tag } from '@/api/tags'
import { buildReorderPayload } from '@/utils/reorder'

const message = useMessage()
const dialog = useDialog()
const { canEdit } = usePermissions()
const loading = ref(false)
const saving = ref(false)

const fetchingFavicon = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const showModal = ref(false)
const showDetailModal = ref(false)
const showSortModal = ref(false)
const sortSaving = ref(false)
const sortItems = ref<Array<{ id: string; label: string; meta?: string }>>([])
const selectedSite = ref<Site | null>(null)
const logoLocalEnabled = ref(false)
const editingId = ref<string | null>(null)
const categories = ref<Category[]>([])
const tags = ref<Tag[]>([])
const sites = ref<Site[]>([])
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
})

const query = reactive({ keyword: '', categoryId: null as string | null, tagId: null as string | null, visible: null as number | null, isPinned: null as number | null })
const form = reactive<SitePayload>({ categoryId: '', name: '', url: '', description: '', logo: '', account: '', password: '', sort: 0, isPinned: 0, visible: 1, tagIds: [] })

const categoryOptions = computed(() => categories.value.map((item) => ({ label: item.name, value: item.id })))
const tagOptions = computed(() => tags.value.map((item) => ({ label: item.name, value: item.id })))

const visibleOptions = [
  { label: '显示', value: 1 },
  { label: '隐藏', value: 0 },
]
const pinnedOptions = [
  { label: '置顶', value: 1 },
  { label: '未置顶', value: 0 },
]
const pinnedChecked = computed({
  get: () => form.isPinned === 1,
  set: (value: boolean) => {
    form.isPinned = value ? 1 : 0
  },
})
const visibleChecked = computed({
  get: () => form.visible !== 0,
  set: (value: boolean) => {
    form.visible = value ? 1 : 0
  },
})

const columns: DataTableColumns<Site> = [
  { title: '名称', key: 'name', minWidth: 140 },
  { title: '分类', key: 'categoryName', width: 120 },
  { title: 'URL', key: 'url', width: 280, render(row) { return renderUrl(row.url) } },
  { title: '置顶', key: 'isPinned', width: 80, render(row) { return row.isPinned === 1 ? '是' : '-' } },
  { title: '点击', key: 'clickCount', width: 90 },

  { title: '排序', key: 'sort', width: 80 },
  {
    title: '显示',
    key: 'visible',
    width: 80,
    render(row) {
      return h(NSwitch, { value: row.visible === 1, disabled: true })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 190,
    fixed: 'right',
    render(row) {
      return h(NSpace, null, {
        default: () => {
          const actions = [h(NButton, { size: 'small', onClick: () => openDetail(row) }, { default: () => '查看' })]
          if (canEdit.value) {
            actions.push(
              h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
              h(NButton, { size: 'small', type: 'error', ghost: true, onClick: () => confirmDelete(row) }, { default: () => '删除' }),
            )
          }
          return actions
        },
      })
    },
  },
]




function copyText(value: string) {
  navigator.clipboard?.writeText(value)
  message.success('已复制')
}

function maskText(value: string, maxLength = 24) {
  if (value.length <= maxLength) return value
  const prefixLength = Math.max(6, maxLength - 10)
  return value.slice(0, prefixLength) + '...' + value.slice(-4)
}

function formatDisplayUrl(value: string) {
  try {
    const url = new URL(value)
    const parts = url.hostname.split('.')
    const maskedHost = parts.length > 2 ? parts[0] + '.***.' + parts.slice(-2).join('.') : url.hostname
    const host = url.port ? maskedHost + ':' + url.port : maskedHost
    return url.protocol + '//' + host
  } catch {
    return maskText(value, 28)
  }
}

function renderCopyButton(value: string) {
  return h(NButton, { size: 'tiny', quaternary: true, circle: true, title: '复制', onClick: () => copyText(value) }, {
    default: () => h('svg', {
      viewBox: '0 0 24 24',
      width: 15,
      height: 15,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      style: 'display:block;color:var(--text-color-2);',
    }, [
      h('rect', { x: 9, y: 9, width: 11, height: 11, rx: 2, ry: 2 }),
      h('path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }),
    ]),
  })
}



function safeUrl(value: string) {
  const url = value.trim()
  return url.startsWith('http://') || url.startsWith('https://') ? url : '#'
}

function renderUrl(value: string) {
  return h(NSpace, { align: 'center', size: 4, wrap: false }, {
    default: () => [
      h('a', { class: 'copy-text url-link', href: safeUrl(value), target: '_blank', rel: 'noopener noreferrer', title: value }, formatDisplayUrl(value)),
      renderCopyButton(value),
    ],
  })
}



function resetForm() {
  editingId.value = null
  form.categoryId = categories.value[0]?.id || ''
  form.name = ''
  form.url = ''
  form.description = ''
  form.logo = ''
  form.account = ''
  form.password = ''
  form.tagIds = []
  form.sort = 0
  form.isPinned = 0
  form.visible = 1
}

async function openCreate() {
  if (!categories.value.length) {
    await loadCategories()
  }

  if (!categories.value.length) {
    message.warning('请先创建或加载分类后再新增站点')
    return
  }

  resetForm()
  showModal.value = true
}

function openEdit(row: Site) {
  editingId.value = row.id
  form.categoryId = row.categoryId
  form.name = row.name
  form.url = row.url
  form.description = row.description || ''
  form.logo = row.logo || ''
  form.account = row.account || ''
  form.password = row.password || ''
  form.tagIds = row.tagIds || row.tags?.map((tag) => tag.id) || []
  form.sort = row.sort
  form.isPinned = row.isPinned
  form.visible = row.visible
  showModal.value = true
}

async function loadCategories() {
  try {
    categories.value = await getCategoryOptions()
  } catch {
    message.error('分类加载失败，请刷新重试')
  }
}

async function loadTags() {
  try {
    tags.value = await getTagOptions()
  } catch {
    message.error('标签加载失败，请刷新重试')
  }
}

async function loadSites() {
  loading.value = true
  try {
    const result = await getSites({
      keyword: query.keyword || undefined,
      categoryId: query.categoryId || undefined,
      tagId: query.tagId || undefined,
      visible: query.visible ?? undefined,
      isPinned: query.isPinned ?? undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    sites.value = result.items
    pagination.itemCount = result.total
    pagination.page = result.page
    pagination.pageSize = result.pageSize
  } catch {
    message.error('加载失败，请刷新重试')
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number) {
  pagination.page = page
  void loadSites()
}

function handlePageSizeChange(pageSize: number) {
  pagination.pageSize = pageSize
  pagination.page = 1
  void loadSites()
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => ({ ...query }),
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      pagination.page = 1
      void loadSites()
    }, 300)
  },
  { deep: true },
)

async function openSortModal() {
  try {
    const result = await getSites({
      keyword: query.keyword || undefined,
      categoryId: query.categoryId || undefined,
      tagId: query.tagId || undefined,
      visible: query.visible ?? undefined,
      isPinned: query.isPinned ?? undefined,
      page: 1,
      pageSize: 500,
    })
    sortItems.value = result.items.map((item) => ({
      id: item.id,
      label: item.name,
      meta: item.categoryName || '未分类',
    }))
    showSortModal.value = true
  } catch {
    message.error('加载排序列表失败')
  }
}

async function handleSortSave(items: Array<{ id: string }>) {
  sortSaving.value = true
  try {
    await reorderSites(buildReorderPayload(items))
    message.success('排序已保存')
    showSortModal.value = false
    await loadSites()
  } catch {
    message.error('排序保存失败')
  } finally {
    sortSaving.value = false
  }
}



function openDetail(row: Site) {
  selectedSite.value = row
  showDetailModal.value = true
}

async function loadLogoSettings() {
  try {
    const settings = await getSettings()
    logoLocalEnabled.value = settings['site.logo_local_enabled'] === '1'
  } catch {
    logoLocalEnabled.value = false
  }
}

function buildFaviconUrls(value: string) {
  try {
    const url = new URL(value.trim())
    return [`${url.origin}/favicon.ico`, `https://favicon.yandex.net/favicon/${url.host}`]
  } catch {
    return []
  }
}

async function loadImageWithTimeout(src: string) {
  await new Promise<void>((resolve, reject) => {
    const img = new Image()
    const timer = window.setTimeout(() => reject(new Error('favicon timeout')), 5000)
    img.onload = () => {
      window.clearTimeout(timer)
      resolve()
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error('favicon not found'))
    }
    img.src = src
  })
}

async function fetchRemoteFavicon(url: string) {
  const faviconUrls = buildFaviconUrls(url)
  for (const faviconUrl of faviconUrls) {
    try {
      await loadImageWithTimeout(faviconUrl)
      return faviconUrl
    } catch {
      // 尝试下一个 favicon 来源
    }
  }
  throw new Error('未获取到可用 favicon')
}

async function handleFetchFavicon() {
  const url = form.url?.trim()
  if (!url || !/^https?:\/\//i.test(url)) {
    message.warning('请先填写有效的站点 URL')
    return
  }

  fetchingFavicon.value = true
  try {
    if (logoLocalEnabled.value) {
      const result = await fetchFaviconToR2(url)
      if (!result?.url) {
        throw new Error('未返回 favicon 地址')
      }
      form.logo = result.url
      message.success('已获取 favicon 并保存到 R2')
    } else {
      form.logo = await fetchRemoteFavicon(url)
      message.success('已获取 favicon URL')
    }
  } catch (error) {
    message.warning(error instanceof Error ? error.message : '未获取到可用 favicon，可手动上传图标')
  } finally {
    fetchingFavicon.value = false
  }
}

async function handleLogoUpload(options: { file: { file?: File | null }; onFinish?: () => void; onError?: () => void }) {
  const file = options.file.file
  if (!file) return
  try {
    const result = await uploadFile(file)
    if (!result?.url) {
      throw new Error('上传成功但未返回文件地址')
    }
    form.logo = result.url
    message.success('Logo 上传成功')
    options.onFinish?.()
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Logo 上传失败')
    options.onError?.()
  }
}

async function handleExportSites() {
  try {
    const data = await exportSiteData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `cloud-blog-lite-sites-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  } catch {
    message.error('导出失败')
  }
}

function triggerImport() {
  importInput.value?.click()
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const payload = JSON.parse(text)
    const preview = await importSiteData(payload, true)
    const confirmed = window.confirm(`预计导入：分类 ${preview?.importedCategories || 0}，标签 ${preview?.importedTags || 0}，站点 ${preview?.importedSites || 0}，跳过 ${preview?.skippedSites || 0}。确认导入吗？`)
    if (!confirmed) return
    const result = await importSiteData(payload)
    message.success(`导入完成：分类 ${result?.importedCategories || 0}，标签 ${result?.importedTags || 0}，站点 ${result?.importedSites || 0}，跳过 ${result?.skippedSites || 0}`)
    await loadCategories()
    await loadTags()
    await loadSites()
  } catch {
    message.error('导入失败，请确认文件格式正确')
  }
}



async function handleSave() {
  if (!form.categoryId || !form.name?.trim() || !form.url?.trim()) {
    message.warning('请填写分类、名称和 URL')
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateSite(editingId.value, form)
      message.success('站点已更新')
    } else {
      await createSite(form)
      message.success('站点已创建')
    }
    showModal.value = false
    await loadSites()
  } catch (error) {
    message.error('保存失败，请检查表单内容')
  } finally {
    saving.value = false
  }
}

function confirmDelete(row: Site) {
  const dialogInstance = dialog.warning({
    title: '确认删除',
    content: `确定删除站点「${row.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      dialogInstance.loading = true
      try {
        await deleteSite(row.id)
        message.success('站点已删除')
        await loadSites()
      } catch {
        message.error('删除失败')
      } finally {
        dialogInstance.loading = false
      }
    },
  })
}

onMounted(async () => {
  await loadLogoSettings()
  await loadCategories()
  await loadTags()
  await loadSites()
})
</script>

<style scoped>
.copy-text {
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
  white-space: nowrap;
}

:deep(.url-link),
.mobile-card-row a {
  color: var(--link);
  text-decoration: none;
}

:deep(.url-link:visited),
.mobile-card-row a:visited {
  color: var(--link-visited);
}

:deep(.url-link:hover),
.mobile-card-row a:hover {
  color: var(--link-hover);
  text-decoration: underline;
}

.detail-secret-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.detail-secret-line span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.copy-icon {
  width: 15px;
  height: 15px;
  display: block;
}

.hidden-file-input {
  display: none;
}

</style>

<template>
  <PageHeader title="站点管理" subtitle="Sites">
    <n-button type="primary" @click="openCreate">新增站点</n-button>
  </PageHeader>

  <n-card class="mb-16 filter-card">
    <n-space align="center">
      <n-input v-model:value="query.keyword" clearable placeholder="搜索站点名称、描述或 URL" class="filter-input" />
      <n-select v-model:value="query.categoryId" clearable placeholder="选择分类" :options="categoryOptions" class="filter-select" />
      <n-button @click="loadSites">查询</n-button>
    </n-space>
  </n-card>

  <n-card>
    <n-data-table
      class="desktop-table"
      :columns="columns"
      :data="sites"
      :loading="loading"
      :pagination="{ pageSize: 10 }"
      :scroll-x="1280"
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
          <a :href="site.url" target="_blank" rel="noopener noreferrer">{{ formatDisplayUrl(site.url) }}</a>
        </div>
        <div v-if="site.account" class="mobile-card-row">
          <span>账号</span>
          <b>{{ site.account }}</b>
        </div>
        <div v-if="site.password" class="mobile-card-row">
          <span>密码</span>
          <b>{{ visiblePasswords[site.id] ? site.password : '••••••••' }}</b>
        </div>
        <div class="mobile-card-row">
          <span>排序</span>
          <b>{{ site.sort }}</b>
        </div>
        <n-space justify="end">
          <n-button v-if="site.password" size="small" @click="visiblePasswords[site.id] = !visiblePasswords[site.id]">
            {{ visiblePasswords[site.id] ? '隐藏密码' : '显示密码' }}
          </n-button>
          <n-button size="small" @click="openEdit(site)">编辑</n-button>
          <n-button size="small" type="error" ghost @click="confirmDelete(site)">删除</n-button>
        </n-space>
      </div>
    </div>
  </n-card>

  <n-modal v-model:show="showModal" preset="card" :title="editingId ? '编辑站点' : '新增站点'" class="form-modal large">
    <n-form label-placement="top">
      <n-form-item label="所属分类" required>
        <n-select v-model:value="form.categoryId" :options="categoryOptions" placeholder="请选择分类" />
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
      <n-grid :cols="2" :x-gap="12">
        <n-form-item-gi label="排序">
          <n-input-number v-model:value="form.sort" class="full-width" />
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
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NSpace, NSwitch, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import { getCategories, type Category } from '@/api/categories'
import { createSite, deleteSite, getSites, updateSite, type Site, type SitePayload } from '@/api/sites'
import { uploadFile } from '@/api/upload'

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const saving = ref(false)
const fetchingFavicon = ref(false)
const showModal = ref(false)
const editingId = ref<string | null>(null)
const categories = ref<Category[]>([])
const sites = ref<Site[]>([])
const visiblePasswords = ref<Record<string, boolean>>({})
const query = reactive({ keyword: '', categoryId: null as string | null })
const form = reactive<SitePayload>({ categoryId: '', name: '', url: '', description: '', logo: '', account: '', password: '', sort: 0, visible: 1 })

const categoryOptions = computed(() => categories.value.map((item) => ({ label: item.name, value: item.id })))
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
  { title: '账号', key: 'account', width: 180, render(row) { return row.account ? renderCopyText(row.account, maskText(row.account, 18)) : '-' } },
  { title: '密码', key: 'password', minWidth: 170, render(row) { return row.password ? renderPassword(row) : '-' } },
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
    width: 170,
    fixed: 'right',
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
    const host = parts.length > 2 ? parts[0] + '.***.' + parts.slice(-2).join('.') : url.hostname
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

function renderPasswordToggleButton(visible: boolean, onClick: () => void) {
  const title = visible ? '隐藏密码' : '显示密码'
  return h(NButton, { size: 'tiny', quaternary: true, circle: true, title, onClick }, {
    default: () => h('svg', {
      viewBox: '0 0 24 24',
      width: 16,
      height: 16,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      style: 'display:block;color:var(--text-color-2);',
    }, visible
      ? [
          h('path', { d: 'M3 3l18 18' }),
          h('path', { d: 'M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58' }),
          h('path', { d: 'M9.88 4.24A10.8 10.8 0 0 1 12 4c5 0 9 4.5 10 8a12.6 12.6 0 0 1-2.12 3.48' }),
          h('path', { d: 'M6.1 6.1C4.08 7.42 2.7 9.55 2 12c1 3.5 5 8 10 8 1.38 0 2.68-.34 3.86-.95' }),
        ]
      : [
          h('path', { d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z' }),
          h('circle', { cx: 12, cy: 12, r: 3 }),
        ]),
  })
}

function renderUrl(value: string) {
  return h(NSpace, { align: 'center', size: 4, wrap: false }, {
    default: () => [
      h('a', { class: 'copy-text url-link', href: value, target: '_blank', rel: 'noopener noreferrer', title: value }, formatDisplayUrl(value)),
      renderCopyButton(value),
    ],
  })
}

function renderCopyText(value: string, displayValue = value) {
  return h(NSpace, { align: 'center', size: 4, wrap: false }, {
    default: () => [
      h('span', { class: 'copy-text', title: value }, displayValue),
      renderCopyButton(value),
    ],
  })
}

function renderPassword(row: Site) {
  const visible = Boolean(visiblePasswords.value[row.id])
  const value = row.password || ''
  return h(NSpace, { align: 'center', size: 4 }, {
    default: () => [
      h('span', { class: 'copy-text' }, visible ? value : '••••••••'),
      renderPasswordToggleButton(visible, () => { visiblePasswords.value[row.id] = !visible }),
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
  form.sort = 0
  form.visible = 1
}

function openCreate() {
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
  form.sort = row.sort
  form.visible = row.visible
  showModal.value = true
}

async function loadCategories() {
  categories.value = await getCategories()
}

async function loadSites() {
  loading.value = true
  try {
    sites.value = await getSites({ keyword: query.keyword, categoryId: query.categoryId || undefined })
  } finally {
    loading.value = false
  }
}

function buildFaviconUrl(value: string) {
  try {
    const url = new URL(value.trim())
    return `${url.origin}/favicon.ico`
  } catch {
    return ''
  }
}

async function handleFetchFavicon() {
  const faviconUrl = buildFaviconUrl(form.url || '')
  if (!faviconUrl) {
    message.warning('请先填写有效的站点 URL')
    return
  }

  fetchingFavicon.value = true
  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('favicon not found'))
      img.src = faviconUrl
    })
    form.logo = faviconUrl
    message.success('已获取 favicon')
  } catch {
    message.warning('未获取到可用 favicon，可手动上传图标')
  } finally {
    fetchingFavicon.value = false
  }
}

async function handleLogoUpload(options: { file: { file?: File | null }; onFinish?: () => void; onError?: () => void }) {
  const file = options.file.file
  if (!file) return
  try {
    const result = await uploadFile(file)
    form.logo = result?.url || ''
    message.success('Logo 上传成功')
    options.onFinish?.()
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Logo 上传失败')
    options.onError?.()
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
  dialog.warning({
    title: '确认删除',
    content: `确定删除站点「${row.name}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await deleteSite(row.id)
      message.success('站点已删除')
      await loadSites()
    },
  })
}

onMounted(async () => {
  await loadCategories()
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

.url-link {
  color: var(--primary-color);
  text-decoration: none;
}

.url-link:hover {
  text-decoration: underline;
}

</style>

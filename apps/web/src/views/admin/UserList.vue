<template>
  <PageHeader title="用户管理" subtitle="Users">
    <n-button type="primary" @click="openCreate">新增用户</n-button>
  </PageHeader>

  <n-card>
    <n-data-table
      class="desktop-table"
      :columns="columns"
      :data="users"
      :loading="loading"
      :pagination="pagination"
      remote
      :scroll-x="920"
    />
    <div class="mobile-card-list">
      <div v-for="user in users" :key="user.id" class="mobile-data-card">
        <div class="mobile-card-head">
          <div>
            <strong>{{ user.username }}</strong>
            <small>{{ user.nickname || '未设置昵称' }}</small>
          </div>
          <n-tag :type="user.role === 'admin' ? 'error' : user.role === 'editor' ? 'info' : 'default'" :bordered="false">
            {{ user.role }}
          </n-tag>
        </div>
        <div class="mobile-card-row">
          <span>状态</span>
          <n-switch :value="user.status === 1" :disabled="user.role === 'admin'" @update:value="handleStatusChange(user, $event)" />
        </div>
        <div class="mobile-card-row"><span>失败次数</span><b>{{ user.loginErrorCount }}</b></div>
        <div class="mobile-card-row"><span>最后登录</span><b>{{ user.lastLoginAt || '-' }}</b></div>
        <n-space justify="end" class="mobile-card-actions">
          <n-button size="small" @click="openEdit(user)">编辑</n-button>
          <n-button size="small" @click="openReset(user)">重置密码</n-button>
          <n-button size="small" type="error" ghost :disabled="isDeleteDisabled(user)" @click="confirmDelete(user)">删除</n-button>
        </n-space>
      </div>
    </div>
  </n-card>

  <n-modal v-model:show="showModal" preset="card" :title="editingId ? '编辑用户' : '新增用户'" class="form-modal">
    <n-form label-placement="top">
      <n-form-item label="用户名" required>
        <n-input v-model:value="form.username" :disabled="Boolean(editingId)" />
      </n-form-item>
      <n-form-item v-if="!editingId" label="初始密码" required>
        <n-input v-model:value="form.password" type="password" />
      </n-form-item>
      <n-form-item label="昵称">
        <n-input v-model:value="form.nickname" />
      </n-form-item>
      <n-form-item label="头像">
        <n-input-group>
          <n-input v-model:value="form.avatar" placeholder="可填写图片 URL 或上传图片" />
          <n-upload :show-file-list="false" :custom-request="handleAvatarUpload">
            <n-button>上传</n-button>
          </n-upload>
        </n-input-group>
      </n-form-item>
      <n-grid :cols="2" :x-gap="12">
        <n-form-item-gi label="角色">
          <n-select filterable v-model:value="form.role" :options="roleOptions" />
        </n-form-item-gi>
        <n-form-item-gi label="启用状态">
          <n-switch v-model:value="statusChecked" />
        </n-form-item-gi>
      </n-grid>
      <n-form-item label="备注">
        <n-input v-model:value="form.remark" type="textarea" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showModal = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
      </n-space>
    </template>
  </n-modal>

  <n-modal v-model:show="showPasswordModal" preset="card" title="重置密码" class="form-modal">
    <n-form label-placement="top">
      <n-form-item label="新密码" required>
        <n-input v-model:value="newPassword" type="password" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showPasswordModal = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="handleResetPassword">确认重置</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from 'vue'
import { NButton, NSpace, NSwitch, NTag, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { createUser, deleteUser, getUsers, resetUserPassword, updateUser, type CreateUserPayload, type User, type UserRole } from '@/api/users'
import { uploadFile } from '@/api/upload'

const message = useMessage()
const dialog = useDialog()
const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const showPasswordModal = ref(false)
const editingId = ref<string | null>(null)
const passwordTargetId = ref<string | null>(null)
const newPassword = ref('')
const users = ref<User[]>([])
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  onUpdatePage(page: number) {
    pagination.page = page
    void loadUsers()
  },
  onUpdatePageSize(pageSize: number) {
    pagination.pageSize = pageSize
    pagination.page = 1
    void loadUsers()
  },
})
const form = reactive<CreateUserPayload>({ username: '', password: '', nickname: '', avatar: '', role: 'viewer', status: 1, remark: '' })
const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '编辑者', value: 'editor' },
  { label: '只读用户', value: 'viewer' },
]

const statusChecked = computed({
  get: () => form.status !== 0,
  set: (value: boolean) => {
    form.status = value ? 1 : 0
  },
})

const activeAdminCount = computed(() => users.value.filter((user) => user.role === 'admin' && user.status === 1).length)

function isDeleteDisabled(user: User) {
  if (user.id === auth.user?.id) return true
  return user.role === 'admin' && user.status === 1 && activeAdminCount.value <= 1
}

function deleteDisabledReason(user: User) {
  if (user.id === auth.user?.id) return '不能删除当前登录用户'
  if (user.role === 'admin' && user.status === 1 && activeAdminCount.value <= 1) return '不能删除唯一活跃管理员'
  return ''
}

const columns: DataTableColumns<User> = [
  { title: '用户名', key: 'username', width: 130 },
  { title: '昵称', key: 'nickname', width: 130 },
  {
    title: '角色',
    key: 'role',
    width: 110,
    render(row) {
      const type = row.role === 'admin' ? 'error' : row.role === 'editor' ? 'info' : 'default'
      return h(NTag, { type, bordered: false }, { default: () => row.role })
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render(row) {
      return h(NSwitch, {
        value: row.status === 1,
        disabled: row.role === 'admin',
        onUpdateValue: (value: boolean) => handleStatusChange(row, value),
      })
    },
  },
  { title: '失败次数', key: 'loginErrorCount', width: 100 },
  { title: '最后登录', key: 'lastLoginAt', minWidth: 180 },
  {
    title: '操作',
    key: 'actions',
    width: 250,
    render(row) {
      return h(NSpace, null, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
          h(NButton, { size: 'small', onClick: () => openReset(row) }, { default: () => '重置密码' }),
          h(NButton, { size: 'small', type: 'error', ghost: true, disabled: isDeleteDisabled(row), onClick: () => confirmDelete(row) }, { default: () => '删除' }),
        ],
      })
    },
  },
]

function resetForm() {
  editingId.value = null
  form.username = ''
  form.password = ''
  form.nickname = ''
  form.avatar = ''
  form.role = 'viewer'
  form.status = 1
  form.remark = ''
}

function openCreate() {
  resetForm()
  showModal.value = true
}

function openEdit(row: User) {
  editingId.value = row.id
  form.username = row.username
  form.password = ''
  form.nickname = row.nickname || ''
  form.avatar = row.avatar || ''
  form.role = row.role
  form.status = row.status
  form.remark = row.remark || ''
  showModal.value = true
}

function openReset(row: User) {
  passwordTargetId.value = row.id
  newPassword.value = ''
  showPasswordModal.value = true
}

async function loadUsers() {
  loading.value = true
  try {
    const result = await getUsers({ page: pagination.page, pageSize: pagination.pageSize })
    users.value = result.items
    pagination.itemCount = result.total
  } catch {
    message.error('加载失败，请刷新重试')
  } finally {
    loading.value = false
  }
}

async function handleAvatarUpload(options: { file: { file?: File | null }; onFinish?: () => void; onError?: () => void }) {
  const file = options.file.file
  if (!file) return
  try {
    const result = await uploadFile(file)
    if (!result?.url) {
      throw new Error('上传成功但未返回文件地址')
    }
    form.avatar = result.url
    message.success('头像上传成功')
    options.onFinish?.()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '头像上传失败')
    options.onError?.()
  }
}

async function handleSave() {
  if (!form.username.trim()) {
    message.warning('请输入用户名')
    return
  }
  if (!editingId.value && form.password.length < 8) {
    message.warning('初始密码至少 8 位')
    return
  }

  saving.value = true
  try {
    if (editingId.value) {
      await updateUser(editingId.value, { nickname: form.nickname, avatar: form.avatar, role: form.role as UserRole, status: form.status, remark: form.remark })
      message.success('用户已更新')
    } else {
      await createUser(form)
      message.success('用户已创建')
    }
    showModal.value = false
    await loadUsers()
  } catch {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function handleStatusChange(row: User, enabled: boolean) {
  if (row.role === 'admin') {
    message.warning('管理员账号状态不能在列表中切换')
    return
  }

  dialog.warning({
    title: enabled ? '确认启用用户' : '确认禁用用户',
    content: `确定${enabled ? '启用' : '禁用'}用户「${row.username}」吗？`,
    positiveText: enabled ? '启用' : '禁用',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await updateUser(row.id, {
          nickname: row.nickname || '',
          avatar: row.avatar || '',
          role: row.role,
          status: enabled ? 1 : 0,
          remark: row.remark || '',
        })
        message.success(enabled ? '用户已启用' : '用户已禁用')
        await loadUsers()
      } catch {
        message.error('状态更新失败')
      }
    },
  })
}

async function handleResetPassword() {
  if (!passwordTargetId.value || newPassword.value.length < 8) {
    message.warning('新密码至少 8 位')
    return
  }
  saving.value = true
  try {
    await resetUserPassword(passwordTargetId.value, newPassword.value)
    message.success('密码已重置')
    showPasswordModal.value = false
  } catch {
    message.error('重置密码失败')
  } finally {
    saving.value = false
  }
}

function confirmDelete(row: User) {
  const disabledReason = deleteDisabledReason(row)
  if (disabledReason) {
    message.warning(disabledReason)
    return
  }

  const dialogInstance = dialog.warning({
    title: '确认删除',
    content: `确定删除用户「${row.username}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      dialogInstance.loading = true
      try {
        await deleteUser(row.id)
        message.success('用户已删除')
        await loadUsers()
      } catch {
        message.error('删除失败')
      } finally {
        dialogInstance.loading = false
      }
    },
  })
}

onMounted(loadUsers)
</script>

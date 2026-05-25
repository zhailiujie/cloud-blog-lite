<template>
  <PageHeader title="用户管理" subtitle="Users">
    <n-button type="primary" @click="openCreate">新增用户</n-button>
  </PageHeader>

  <n-card>
    <n-data-table :columns="columns" :data="users" :loading="loading" :pagination="{ pageSize: 10 }" />
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
          <n-select v-model:value="form.role" :options="roleOptions" />
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
import { createUser, deleteUser, getUsers, resetUserPassword, updateUser, type CreateUserPayload, type User, type UserRole } from '@/api/users'
import { uploadFile } from '@/api/upload'

const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const saving = ref(false)
const showModal = ref(false)
const showPasswordModal = ref(false)
const editingId = ref<string | null>(null)
const passwordTargetId = ref<string | null>(null)
const newPassword = ref('')
const users = ref<User[]>([])
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
          h(NButton, { size: 'small', type: 'error', ghost: true, onClick: () => confirmDelete(row) }, { default: () => '删除' }),
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
    users.value = await getUsers()
  } finally {
    loading.value = false
  }
}

async function handleAvatarUpload(options: { file: { file?: File | null }; onFinish?: () => void; onError?: () => void }) {
  const file = options.file.file
  if (!file) return
  try {
    const result = await uploadFile(file)
    form.avatar = result?.url || ''
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
  } finally {
    saving.value = false
  }
}

function confirmDelete(row: User) {
  dialog.warning({
    title: '确认删除',
    content: `确定删除用户「${row.username}」吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await deleteUser(row.id)
      message.success('用户已删除')
      await loadUsers()
    },
  })
}

onMounted(loadUsers)
</script>

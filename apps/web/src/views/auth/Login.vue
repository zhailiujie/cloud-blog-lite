<template>
  <main class="page auth-page">
    <n-card title="登录" class="auth-card">
      <n-form>
        <n-form-item label="用户名">
          <n-input v-model:value="form.username" placeholder="admin" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="form.password" type="password" placeholder="请输入密码" @keyup.enter="handleLogin" />
        </n-form-item>
        <n-button type="primary" block :loading="auth.loading" @click="handleLogin">登录</n-button>
      </n-form>
    </n-card>
  </main>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const message = useMessage()
const auth = useAuthStore()
const form = reactive({ username: 'admin', password: '' })

async function handleLogin() {
  if (!form.username || !form.password) {
    message.warning('请输入用户名和密码')
    return
  }

  try {
    await auth.login(form.username, form.password)
    message.success('登录成功')
    router.push('/admin')
  } catch (error) {
    message.error('登录失败，请检查用户名或密码')
  }
}
</script>

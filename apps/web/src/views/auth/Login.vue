<template>
  <main class="page auth-page">
    <n-card title="登录" class="auth-card">
      <n-form>
        <n-form-item label="用户名">
          <n-input v-model:value="form.username" placeholder="请输入用户名" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input v-model:value="form.password" type="password" placeholder="请输入密码" @keyup.enter="handleLogin" />
        </n-form-item>
        <n-form-item>
          <div ref="turnstileEl" class="turnstile-box"></div>
        </n-form-item>
        <n-button type="primary" block :loading="auth.loading" @click="handleLogin">登录</n-button>
      </n-form>
    </n-card>
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCard, NForm, NFormItem, NInput, useMessage } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAADVriFpke3k5uAbM'
const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script'
const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const router = useRouter()
const message = useMessage()
const auth = useAuthStore()
const form = reactive({ username: '', password: '' })
const turnstileEl = ref<HTMLElement | null>(null)
const turnstileToken = ref('')
let turnstileWidgetId: string | null = null

function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Turnstile script load failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = TURNSTILE_SCRIPT_ID
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Turnstile script load failed'))
    document.head.appendChild(script)
  })
}

async function renderTurnstile() {
  if (!turnstileEl.value) return
  await loadTurnstileScript()
  if (!window.turnstile || turnstileWidgetId) return

  turnstileWidgetId = window.turnstile.render(turnstileEl.value, {
    sitekey: TURNSTILE_SITE_KEY,
    callback: (token: string) => {
      turnstileToken.value = token
    },
    'expired-callback': () => {
      turnstileToken.value = ''
    },
    'error-callback': () => {
      turnstileToken.value = ''
    },
  })
}

function resetTurnstile() {
  turnstileToken.value = ''
  if (window.turnstile && turnstileWidgetId) {
    window.turnstile.reset(turnstileWidgetId)
  }
}

function getLoginErrorMessage(error: unknown) {
  const responseMessage = (error as { response?: { data?: { message?: string } } }).response?.data?.message
  return responseMessage || '登录失败，请检查用户名、密码或人机验证'
}

async function handleLogin() {
  if (!form.username || !form.password) {
    message.warning('请输入用户名和密码')
    return
  }
  if (!turnstileToken.value) {
    message.warning('请先完成人机验证')
    return
  }

  try {
    await auth.login(form.username, form.password, turnstileToken.value)
    message.success('登录成功')
    router.push('/admin')
  } catch (error) {
    resetTurnstile()
    message.error(getLoginErrorMessage(error))
  }
}

onMounted(() => {
  renderTurnstile().catch(() => {
    message.error('人机验证加载失败，请刷新页面重试')
  })
})

onBeforeUnmount(() => {
  if (window.turnstile && turnstileWidgetId) {
    window.turnstile.remove(turnstileWidgetId)
  }
})
</script>

<style scoped>
.turnstile-box {
  min-height: 65px;
}
</style>

<template>
  <n-popover v-if="auth.user" v-model:show="popoverVisible" trigger="click" placement="bottom-end" :show-arrow="true" raw>
    <template #trigger>
      <n-button quaternary circle title="账户">
        <template #icon>
          <span class="nav-auth-avatar">{{ userInitial }}</span>
        </template>
      </n-button>
    </template>
    <div class="nav-auth-menu glass-panel">
      <button type="button" class="nav-auth-menu-item" @click="goAdmin">
        <svg class="nav-auth-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>进入后台</span>
      </button>
      <button type="button" class="nav-auth-menu-item danger" @click="handleLogout">
        <svg class="nav-auth-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
        <span>退出登录</span>
      </button>
    </div>
  </n-popover>
  <n-button v-else quaternary circle title="登录" @click="router.push('/login')">
    <template #icon>
      <svg class="nav-auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 21a8 8 0 1 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </template>
  </n-button>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NPopover } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const popoverVisible = ref(false)

const userInitial = computed(() => {
  const name = auth.user?.nickname || auth.user?.username || '?'
  return [...name][0] || '?'
})

function goAdmin() {
  popoverVisible.value = false
  router.push('/admin')
}

async function handleLogout() {
  popoverVisible.value = false
  await auth.logout()
  router.push('/')
}

onMounted(async () => {
  if (auth.user) return
  try {
    await auth.fetchMe()
  } catch {
    // 未登录保持登录入口
  }
})
</script>

<style scoped>
.nav-auth-icon {
  width: 18px;
  height: 18px;
  display: block;
  color: var(--text-color-2, var(--muted));
}

.nav-auth-avatar {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  line-height: 1;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #a855f7);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.28);
}

.nav-auth-menu {
  padding: 6px;
  border-radius: 16px;
  min-width: 152px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
}

.nav-auth-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  padding: 10px 12px;
  border-radius: 12px;
  text-align: left;
  cursor: pointer;
  color: var(--text);
  font-size: 14px;
  transition: background 0.18s ease, color 0.18s ease;
}

.nav-auth-menu-item:hover {
  background: color-mix(in srgb, var(--primary), transparent 88%);
  color: var(--primary);
}

.nav-auth-menu-item.danger:hover {
  background: color-mix(in srgb, #ef4444, transparent 88%);
  color: #ef4444;
}

.nav-auth-menu-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
</style>

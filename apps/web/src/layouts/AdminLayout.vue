<template>
  <n-layout has-sider class="admin-layout">
    <n-layout-sider bordered collapse-mode="width" :collapsed-width="64" :width="230">
      <div class="brand">
        <div class="brand-mark small">Y</div>
        <div>
          <strong>cloud-blog-lite</strong>
          <span>管理后台</span>
        </div>
      </div>
      <n-menu :options="menuOptions" />
    </n-layout-sider>
    <n-layout>
      <n-layout-header bordered class="admin-header">
        <div>
          <strong>后台管理</strong>
          <span>轻量导航系统</span>
        </div>
        <n-space align="center">
          <ThemeSwitch />
          <span class="user-name">{{ auth.user?.nickname || auth.user?.username }}</span>
          <n-button size="small" @click="handleLogout">退出</n-button>
        </n-space>
      </n-layout-header>
      <n-layout-content class="admin-content">
        <router-view />
      </n-layout-content>
    </n-layout>
  </n-layout>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import ThemeSwitch from '@/components/ThemeSwitch.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const message = useMessage()
const auth = useAuthStore()
const link = (label: string, to: string) => () => h(RouterLink, { to }, { default: () => label })

const menuOptions = computed(() => {
  const base = [
    { label: link('仪表盘', '/admin'), key: 'dashboard' },
    { label: link('分类管理', '/admin/categories'), key: 'categories' },
    { label: link('站点管理', '/admin/sites'), key: 'sites' },
  ]

  if (auth.user?.role === 'admin') {
    base.push(
      { label: link('用户管理', '/admin/users'), key: 'users' },
      { label: link('系统设置', '/admin/settings'), key: 'settings' },
      { label: link('操作日志', '/admin/logs'), key: 'logs' },
    )
  }

  return base
})

async function handleLogout() {
  await auth.logout()
  message.success('已退出登录')
  router.push('/login')
}
</script>

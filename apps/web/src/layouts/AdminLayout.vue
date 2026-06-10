<template>
  <n-layout has-sider class="admin-layout">
    <n-layout-sider class="admin-sider" bordered collapse-mode="width" :collapsed-width="64" :width="230">
      <div class="brand">
        <img class="brand-logo" :src="siteLogo" alt="logo" />
        <div>
          <strong>cloud-blog-lite</strong>
          <span>管理后台</span>
        </div>
      </div>
      <n-menu :options="menuOptions" />
    </n-layout-sider>
    <n-drawer v-model:show="mobileMenuOpen" placement="left" :width="260">
      <n-drawer-content title="后台菜单" closable>
        <div class="brand mobile-drawer-brand">
          <img class="brand-logo" :src="siteLogo" alt="logo" />
          <div>
            <strong>cloud-blog-lite</strong>
            <span>管理后台</span>
          </div>
        </div>
        <n-menu :options="menuOptions" @update:value="mobileMenuOpen = false" />
      </n-drawer-content>
    </n-drawer>
    <n-layout>
      <n-layout-header bordered class="admin-header">
        <div class="admin-title">
          <n-button class="mobile-menu-button" quaternary circle title="打开菜单" @click="mobileMenuOpen = true">
            <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          </n-button>
          <div>
            <strong>后台管理</strong>
            <span>轻量导航系统</span>
          </div>
        </div>
        <n-space align="center">
          <ThemeSwitch />
          <n-button quaternary circle title="打开导航页" @click="router.push('/')">
            <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 11l9-8 9 8" />
              <path d="M5 10v10h14V10" />
              <path d="M9 20v-6h6v6" />
            </svg>
          </n-button>
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
import { computed, h, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { NButton, NDrawer, NDrawerContent, NLayout, NLayoutContent, NLayoutHeader, NLayoutSider, NMenu, NSpace, useMessage } from 'naive-ui'
import ThemeSwitch from '@/components/ThemeSwitch.vue'
import { useAuthStore } from '@/stores/auth'
import { getSettings } from '@/api/settings'

const router = useRouter()
const message = useMessage()
const auth = useAuthStore()
const mobileMenuOpen = ref(false)

// 优先取后台上传的 logo，否则回退到本地 SVG
const siteLogo = ref('/logo.svg')

onMounted(async () => {
  try {
    const settings = await getSettings()
    if (settings['site.logo']) siteLogo.value = settings['site.logo']
  } catch {
    // 保持 /logo.svg 兜底，不影响布局
  }
})
const link = (label: string, to: string) => () => h(RouterLink, { to }, { default: () => label })

const menuOptions = computed(() => {
  const base = [
    { label: link('仪表盘', '/admin'), key: 'dashboard' },
    { label: link('分类管理', '/admin/categories'), key: 'categories' },
    { label: link('站点管理', '/admin/sites'), key: 'sites' },
    { label: link('标签管理', '/admin/tags'), key: 'tags' },
    { label: link('点击统计', '/admin/clicks'), key: 'clicks' },
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

<style scoped>
.mobile-menu-button {
  display: none;
}

.admin-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mobile-drawer-brand {
  height: auto;
  padding: 0 0 16px;
}

.header-icon {
  width: 16px;
  height: 16px;
  display: block;
}

@media (max-width: 860px) {
  .admin-sider {
    display: none;
  }

  .mobile-menu-button {
    display: inline-flex;
  }

  .admin-header {
    height: auto;
    min-height: 56px;
    padding: 10px 12px;
    gap: 12px;
  }

  .admin-header :deep(.n-space) {
    gap: 8px !important;
  }

  .user-name {
    display: none;
  }

  .admin-content {
    padding: 16px 12px;
  }
}
</style>

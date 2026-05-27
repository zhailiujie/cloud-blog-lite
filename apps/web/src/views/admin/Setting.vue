<template>
  <PageHeader title="系统设置" subtitle="Settings" />
  <n-card>
    <n-form label-placement="top" class="settings-form">
      <n-form-item label="站点标题">
        <n-input v-model:value="form['site.title']" />
      </n-form-item>
      <n-form-item label="站点描述">
        <n-input v-model:value="form['site.description']" type="textarea" />
      </n-form-item>
      <n-form-item label="站点 Logo">
        <n-input-group>
          <n-input v-model:value="form['site.logo']" placeholder="可填写图片 URL 或上传图片" />
          <n-upload :show-file-list="false" :custom-request="handleLogoUpload">
            <n-button>上传</n-button>
          </n-upload>
        </n-input-group>
      </n-form-item>
      <n-form-item label="页脚文案">
        <n-input v-model:value="form['site.footer_text']" />
      </n-form-item>
      <n-button type="primary" :loading="saving" :disabled="!isDirty" @click="handleSave">保存设置</n-button>
    </n-form>
  </n-card>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import PageHeader from '@/components/PageHeader.vue'
import { getSettings, updateSettings } from '@/api/settings'
import { uploadFile } from '@/api/upload'

const message = useMessage()
const saving = ref(false)
const form = reactive<Record<string, string>>({
  'site.title': '',
  'site.description': '',
  'site.logo': '',
  'site.footer_text': '',
})

const originalForm = ref<Record<string, string>>({})
const isDirty = computed(() => JSON.stringify(form) !== JSON.stringify(originalForm.value))

async function loadSettings() {
  try {
    const data = await getSettings()
    Object.assign(form, data)
    originalForm.value = { ...form }
  } catch {
    message.error('加载失败，请刷新重试')
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
    form['site.logo'] = result.url
    message.success('Logo 上传成功')
    options.onFinish?.()
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Logo 上传失败')
    options.onError?.()
  }
}

async function handleSave() {
  saving.value = true
  try {
    await updateSettings(form)
    originalForm.value = { ...form }
    message.success('设置已保存')
  } catch {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

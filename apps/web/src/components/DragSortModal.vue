<template>
  <n-modal v-model:show="show" preset="card" :title="title" class="form-modal">
    <p class="sort-hint">拖拽条目调整顺序，保存后生效。</p>
    <ul class="sort-list">
      <li
        v-for="(item, index) in localItems"
        :key="item.id"
        class="sort-item"
        :class="{ dragging: dragIndex === index, 'drag-over': dragOverIndex === index }"
        draggable="true"
        @dragstart="onDragStart(index)"
        @dragend="onDragEnd"
        @dragover.prevent="onDragOver(index)"
        @drop.prevent="onDrop(index)"
      >
        <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        <span class="sort-label">{{ item.label }}</span>
        <span v-if="item.meta" class="sort-meta">{{ item.meta }}</span>
      </li>
    </ul>
    <template #footer>
      <n-space justify="end">
        <n-button @click="show = false">取消</n-button>
        <n-button type="primary" :loading="saving" @click="handleSave">保存排序</n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NModal, NSpace } from 'naive-ui'

export interface SortItem {
  id: string
  label: string
  meta?: string
}

const props = defineProps<{
  title: string
  items: SortItem[]
  saving?: boolean
}>()

const emit = defineEmits<{
  save: [items: SortItem[]]
}>()

const show = defineModel<boolean>('show', { default: false })
const localItems = ref<SortItem[]>([])
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

watch(
  () => props.items,
  (value) => {
    localItems.value = value.map((item) => ({ ...item }))
  },
  { immediate: true, deep: true },
)

function onDragStart(index: number) {
  dragIndex.value = index
}

function onDragEnd() {
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDragOver(index: number) {
  dragOverIndex.value = index
}

function onDrop(index: number) {
  const from = dragIndex.value
  if (from === null || from === index) return
  const next = [...localItems.value]
  const [moved] = next.splice(from, 1)
  next.splice(index, 0, moved)
  localItems.value = next
  dragIndex.value = null
  dragOverIndex.value = null
}

function handleSave() {
  emit('save', localItems.value)
}
</script>

<style scoped>
.sort-hint {
  margin: 0 0 12px;
  color: var(--text-color-3);
  font-size: 13px;
}

.sort-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}

.sort-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--card-color);
  cursor: grab;
}

.sort-item.dragging {
  opacity: 0.55;
}

.sort-item.drag-over {
  border-color: var(--primary-color);
}

.drag-handle {
  color: var(--text-color-3);
  letter-spacing: -2px;
  user-select: none;
}

.sort-label {
  flex: 1;
  min-width: 0;
}

.sort-meta {
  color: var(--text-color-3);
  font-size: 12px;
}
</style>

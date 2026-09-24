<script lang="ts" setup>
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'

const props = defineProps<{
  item: AnalysisResult
}>()

const emits = defineEmits<{
  (e: 'open-detail', item: AnalysisResult): void
  (e: 'delete', item: AnalysisResult): void
}>()

// URL
const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.apiUrl
// 根据百分比动态计算颜色
function getAquaColor(percentage: number) {
  const hue = (percentage / 100) * 120
  return `hsl(${hue}, 70%, 50%)`
}

function getCloudColor(percentage: number) {
  const lightness = 80 - (percentage / 100) * 40
  return `hsl(0, 0%, ${lightness}%)`
}

const seaBluenessPercentage = computed(() => {
  // 优先综合海蓝指数（新旧口径同义，均含云量折减）；缺失时退回 sea_blueness（仅 v1 有此情况）
  const v = props.item.blueness_index ?? props.item.sea_blueness
  return (v ?? 0) * 100
})
const cloudCoveragePercentage = computed(() => (props.item.cloud_coverage ?? 0) * 100)

// 云量过高的记录在卡片上打上标记，提示水色数值可信度低
const isCloudy = computed(() => props.item.status === 'cloudy')

function openDetail() {
  emits('open-detail', props.item)
}

// 删除按钮：两段式确认，3 秒内再次点击才触发删除
const isConfirmingDelete = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | undefined

function handleDeleteClick() {
  if (!isConfirmingDelete.value) {
    isConfirmingDelete.value = true
    confirmTimer = setTimeout(() => (isConfirmingDelete.value = false), 3000)
    return
  }
  clearTimeout(confirmTimer)
  isConfirmingDelete.value = false
  emits('delete', props.item)
}

// 图片预览（历史数据无 01b 高清化图，onerror 时从预览列表剔除）
const isPreviewOpen = ref(false)
const previewIndex = ref(0)
const superResFailed = ref(false)
const classFailed = ref(false)
const previewImages = computed(() => {
  const list = [
    { src: `${apiUrl}/${props.item.output_directory}/01_input_processed.png`, alt: '原图' },
    { src: `${apiUrl}/${props.item.output_directory}/01b_superresolved.png`, alt: '高清化' },
    { src: `${apiUrl}/${props.item.output_directory}/04_hsv_classification.png`, alt: '分类结果' },
  ]
  return list.filter(img =>
    (img.alt !== '高清化' || !superResFailed.value) && (img.alt !== '分类结果' || !classFailed.value))
})

function openPreview(index: number) {
  previewIndex.value = index
  isPreviewOpen.value = true
}
</script>

<template>
  <div class="group p-4 border border-gray-200 rounded-lg bg-white flex flex-col cursor-pointer shadow-sm transition-all duration-300 space-y-3 dark:border-gray-700 dark:bg-gray-800 hover:shadow-lg hover:-translate-y-1" @click="openDetail">
    <!-- 头部信息 -->
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-500 font-mono dark:text-gray-400">
        {{ format(fromUnixTime(item.timestamp), 'yyyy-MM-dd HH:mm') }}
      </span>
      <div class="flex gap-1 items-center">
        <span
          v-if="isCloudy"
          class="text-xs text-amber-700 font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40"
          title="云量 ≥ 50%，水色数值可信度低"
        >云厚</span>
        <button
          class="p-1 rounded transition-colors"
          :class="isConfirmingDelete
            ? 'bg-red-100 text-red-500 dark:bg-red-900/40'
            : 'text-gray-300 hover:text-red-500 hover:bg-red-50 dark:text-gray-600 dark:hover:bg-red-900/30'"
          :title="isConfirmingDelete ? '再次点击确认删除' : '删除该条数据'"
          @click.stop="handleDeleteClick"
        >
          <div :class="isConfirmingDelete ? 'i-carbon-checkmark' : 'i-carbon-trash-can'" class="h-4 w-4" />
        </button>
        <div class="i-carbon-chevron-right text-gray-300 h-4 w-4 transition-colors dark:text-gray-600 group-hover:text-teal-500 dark:group-hover:text-teal-400" />
      </div>
    </div>

    <!-- 进度条 -->
    <div class="space-y-3">
      <ProgressBar
        label="海蓝程度"
        :percentage="seaBluenessPercentage"
        :color="getAquaColor(seaBluenessPercentage)"
      />
      <ProgressBar
        label="云层覆盖率"
        :percentage="cloudCoveragePercentage"
        :color="getCloudColor(cloudCoveragePercentage)"
      />
    </div>

    <!-- 调试图片 -->
    <div class="pt-2" @click.stop>
      <div class="gap-2 grid grid-cols-3">
        <div>
          <p class="text-xs text-gray-500 mb-1 text-center">
            原图
          </p>
          <img
            :src="`${apiUrl}/${item.output_directory}/01_input_processed.png`"
            alt="Input"
            class="border border-gray-200 rounded-md w-full aspect-square cursor-zoom-in object-cover dark:border-gray-600"
            @click="openPreview(0)"
          >
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1 text-center">
            高清化
          </p>
          <img
            :src="`${apiUrl}/${item.output_directory}/01b_superresolved.png`"
            alt="Super Resolved"
            class="border border-gray-200 rounded-md w-full aspect-square cursor-zoom-in object-cover dark:border-gray-600"
            @error="superResFailed = true"
            @click="openPreview(superResFailed ? 0 : 1)"
          >
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1 text-center">
            分类结果
          </p>
          <img
            :src="`${apiUrl}/${item.output_directory}/04_hsv_classification.png`"
            alt="HSV Classification"
            class="border border-gray-200 rounded-md w-full aspect-square cursor-zoom-in object-cover dark:border-gray-600"
            @error="classFailed = true"
            @click="openPreview(2)"
          >
        </div>
      </div>

      <ImagePreview
        v-model:open="isPreviewOpen"
        :images="previewImages"
        :initial-index="previewIndex"
      />
    </div>
  </div>
</template>

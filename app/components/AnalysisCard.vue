<script lang="ts" setup>
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'

const props = defineProps<{
  item: AnalysisResult
}>()

const emits = defineEmits<{
  (e: 'timestamp-selected', timestamp: number): void
}>()

// URL
const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.apiUrl
console.log(apiUrl)
// 根据百分比动态计算颜色
function getAquaColor(percentage: number) {
  const hue = (percentage / 100) * 120
  return `hsl(${hue}, 70%, 50%)`
}

function getCloudColor(percentage: number) {
  const lightness = 80 - (percentage / 100) * 40
  return `hsl(0, 0%, ${lightness}%)`
}

const seaBluenessPercentage = computed(() => (props.item.sea_blueness ?? 0) * 100)
const cloudCoveragePercentage = computed(() => (props.item.cloud_coverage ?? 0) * 100)

function selectTimestamp() {
  emits('timestamp-selected', props.item.timestamp)
}

// 图片预览
const isPreviewOpen = ref(false)
const previewIndex = ref(0)
const previewImages = computed(() => [
  { src: `${apiUrl}/${props.item.output_directory}/01_input_processed.png`, alt: '原图' },
  { src: `${apiUrl}/${props.item.output_directory}/04_hsv_classification.png`, alt: '分类结果' },
])

function openPreview(index: number) {
  previewIndex.value = index
  isPreviewOpen.value = true
}
</script>

<template>
  <div class="p-4 border border-gray-200 rounded-lg bg-white flex flex-col shadow-sm transition-all duration-300 space-y-3 dark:border-gray-700 dark:bg-gray-800 hover:shadow-lg hover:-translate-y-1" @click="selectTimestamp">
    <!-- 头部信息 -->
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-500 font-mono dark:text-gray-400">
        {{ format(fromUnixTime(item.timestamp), 'yyyy-MM-dd HH:mm') }}
      </span>
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
      <div class="gap-2 grid grid-cols-2">
        <div>
          <p class="text-xs text-gray-500 mb-1 text-center">
            原图
          </p>
          <img
            :src="`${apiUrl}/${item.output_directory}/01_input_processed.png`"
            alt="Ocean Only"
            class="border border-gray-200 rounded-md w-full aspect-square cursor-zoom-in object-cover dark:border-gray-600"
            @click="openPreview(0)"
          >
        </div>
        <div>
          <p class="text-xs text-gray-500 mb-1 text-center">
            分类结果
          </p>
          <img
            :src="`${apiUrl}/${item.output_directory}/04_hsv_classification.png`"
            alt="K-Means Classification"
            class="border border-gray-200 rounded-md w-full aspect-square cursor-zoom-in object-cover dark:border-gray-600"
            @click="openPreview(1)"
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

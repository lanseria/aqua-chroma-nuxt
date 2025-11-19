<script lang="ts" setup>
import type { AnalysisResult } from '~/stores/analysis'

const props = defineProps<{
  item: AnalysisResult
}>()

const emits = defineEmits<{
  (e: 'timestamp-selected', timestamp: number): void
}>()

const dayjs = useDayjs()

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

// --- 新增：将 0-1 的浮点数转换为 0-100 的百分比，并处理 null ---
const seaBluenessPercentage = computed(() => (props.item.sea_blueness ?? 0) * 100)
const cloudCoveragePercentage = computed(() => (props.item.cloud_coverage ?? 0) * 100)

function selectTimestamp() {
  emits('timestamp-selected', props.item.timestamp)
}
</script>

<template>
  <div class="p-4 border border-gray-200 rounded-lg bg-white flex flex-col shadow-sm transition-all duration-300 space-y-3 dark:border-gray-700 dark:bg-gray-800 hover:shadow-lg hover:-translate-y-1" @click="selectTimestamp">
    <!-- 头部信息 -->
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-500 font-mono dark:text-gray-400">
        <!-- 仅显示年月日 时分 -->
        {{ dayjs.unix(item.timestamp).format('YYYY-MM-DD HH:mm') }}
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

    <!-- 调试图片 (点击预览，阻止冒泡防止触发卡片选择) -->
    <div class="pt-2" @click.stop>
      <AImagePreviewGroup infinite>
        <div class="gap-2 grid grid-cols-2">
          <div>
            <p class="text-xs text-gray-500 mb-1 text-center">
              原图
            </p>
            <AImage
              :src="`${apiUrl}/${item.output_directory}/01_input_processed.png`"
              alt="Ocean Only"
              width="100%"
              fit="cover"
              class="border rounded-md aspect-square dark:border-gray-600 !block"
              :preview-props="{
                actionsLayout: ['rotateRight', 'zoomIn', 'zoomOut', 'fullScreen'],
              }"
            />
          </div>
          <div>
            <p class="text-xs text-gray-500 mb-1 text-center">
              分类结果
            </p>
            <AImage
              :src="`${apiUrl}/${item.output_directory}/04_hsv_classification.png`"
              alt="K-Means Classification"
              width="100%"
              fit="cover"
              class="border rounded-md aspect-square dark:border-gray-600 !block"
              :preview-props="{
                actionsLayout: ['rotateRight', 'zoomIn', 'zoomOut', 'fullScreen'],
              }"
            />
          </div>
        </div>
      </AImagePreviewGroup>
    </div>
  </div>
</template>

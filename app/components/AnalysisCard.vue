<script lang="ts" setup>
import type { AnalysisResult } from '~/stores/analysis'

const props = defineProps<{
  item: AnalysisResult
}>()

const dayjs = useDayjs()

// URL
const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.apiUrl

// 根据状态返回不同的颜色 class
const statusClasses = computed(() => {
  switch (props.item.status) {
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    // --- 新增 'night' 状态 ---
    case 'night':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
})

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
</script>

<template>
  <div class="p-4 border border-gray-200 rounded-lg bg-white flex flex-col shadow-sm transition-all duration-300 space-y-3 dark:border-gray-700 dark:bg-gray-800 hover:shadow-lg hover:-translate-y-1">
    <!-- 头部信息 -->
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-500 font-mono dark:text-gray-400">
        <!-- --- 修改点：使用 dayjs.unix() 处理 Unix 时间戳 --- -->
        {{ dayjs.unix(item.timestamp).format('YYYY-MM-DD HH:mm:ss') }}
      </span>
      <span
        class="text-xs font-medium px-2.5 py-0.5 rounded-full capitalize"
        :class="statusClasses"
      >
        {{ item.status }}
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
    <div class="pt-2 gap-2 grid grid-cols-2">
      <div>
        <p class="text-xs text-gray-500 mb-1 text-center">
          海洋掩码
        </p>
        <img :src="`${apiUrl}/${item.output_directory}/03_ocean_only.png`" alt="Ocean Only" class="border rounded-md dark:border-gray-600">
      </div>
      <div>
        <p class="text-xs text-gray-500 mb-1 text-center">
          云层掩码
        </p>
        <img :src="`${apiUrl}/${item.output_directory}/04_cloud_mask.png`" alt="Cloud Mask" class="border rounded-md dark:border-gray-600">
      </div>
    </div>
  </div>
</template>

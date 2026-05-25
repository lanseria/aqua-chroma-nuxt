<script lang="ts" setup>
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'

const props = defineProps<{
  result: AnalysisResult
  apiUrl: string
}>()

const imageFilenames = [
  '01_input_processed.png',
  '03_ocean_only.png',
  '04_hsv_classification.png',
]

const formattedData = computed(() => [
  { label: '时间', value: format(fromUnixTime(props.result.timestamp), 'yyyy-MM-dd HH:mm:ss') },
  { label: '状态', value: props.result.status },
  { label: '海蓝程度', value: props.result.sea_blueness !== null ? `${(props.result.sea_blueness * 100).toFixed(4)}%` : 'N/A' },
  { label: '云层覆盖率', value: props.result.cloud_coverage !== null ? `${(props.result.cloud_coverage * 100).toFixed(4)}%` : 'N/A' },
])
</script>

<template>
  <div class="space-y-6">
    <!-- 关键数据展示 -->
    <div>
      <h3 class="text-lg text-gray-800 font-semibold mb-3 dark:text-gray-200">
        分析数据
      </h3>
      <dl class="p-3 border rounded-lg bg-gray-50 gap-x-4 gap-y-2 grid grid-cols-[auto_1fr] dark:border-gray-700 dark:bg-gray-800">
        <template v-for="item in formattedData" :key="item.label">
          <dt class="text-gray-600 font-medium dark:text-gray-400">
            {{ item.label }}:
          </dt>
          <dd class="text-gray-800 font-mono dark:text-gray-200">
            {{ item.value }}
          </dd>
        </template>
      </dl>
    </div>

    <!-- 调试图像展示 -->
    <div>
      <h3 class="text-lg text-gray-800 font-semibold mb-3 dark:text-gray-200">
        调试图像
      </h3>
      <div class="gap-4 grid grid-cols-2 sm:grid-cols-3">
        <div v-for="filename in imageFilenames" :key="filename" class="border rounded-md overflow-hidden dark:border-gray-700">
          <a :href="`${apiUrl}/${result.output_directory}/${filename}`" target="_blank" rel="noopener noreferrer">
            <img
              :src="`${apiUrl}/${result.output_directory}/${filename}`"
              :alt="filename"
              class="w-full aspect-square transition-transform duration-300 object-cover hover:scale-105"
            >
          </a>
          <p class="text-xs text-gray-600 p-1.5 text-center bg-gray-50 dark:text-gray-400 dark:bg-gray-800">
            {{ filename }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

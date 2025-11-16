<script lang="ts" setup>
// 更新的调试结果数据结构，与后端响应保持一致
interface DebugData {
  timestamp: number
  status: 'completed' | 'night'
  seaBlueness: number | null // 字段名从 snake_case 变为 camelCase
  cloudCoverage: number | null // 字段名从 snake_case 变为 camelCase
  bluePercentage: number | null // 新增字段
  yellowPercentage: number | null // 新增字段
  bluePixels: number | null // 新增字段
  yellowPixels: number | null // 新增字段
  cloudPixels: number | null // 新增字段
  output_directory: string
}

const props = defineProps<{
  result: DebugData
  apiUrl: string
}>()

const dayjs = useDayjs()

// 更新调试图片文件名列表
const imageFilenames = [
  '01_input_processed.png',
  '03_ocean_only.png',
  '04_hsv_classification.png',
]

// 格式化数据，使其更易读，并包含所有新字段
const formattedData = computed(() => [
  { label: '时间', value: dayjs.unix(props.result.timestamp).format('YYYY-MM-DD HH:mm:ss') },
  { label: '状态', value: props.result.status },
  { label: '海蓝程度', value: props.result.seaBlueness !== null ? `${(props.result.seaBlueness * 100).toFixed(4)}%` : 'N/A' },
  { label: '云层覆盖率', value: props.result.cloudCoverage !== null ? `${(props.result.cloudCoverage * 100).toFixed(4)}%` : 'N/A' },
  { label: '蓝色百分比', value: props.result.bluePercentage !== null ? `${(props.result.bluePercentage * 100).toFixed(4)}%` : 'N/A' },
  { label: '黄色百分比', value: props.result.yellowPercentage !== null ? `${(props.result.yellowPercentage * 100).toFixed(4)}%` : 'N/A' },
  { label: '蓝色像素', value: props.result.bluePixels?.toLocaleString() ?? 'N/A' },
  { label: '黄色像素', value: props.result.yellowPixels?.toLocaleString() ?? 'N/A' },
  { label: '云像素', value: props.result.cloudPixels?.toLocaleString() ?? 'N/A' },
  { label: '输出目录', value: props.result.output_directory },
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

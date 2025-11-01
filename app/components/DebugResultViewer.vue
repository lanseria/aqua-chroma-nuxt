<script lang="ts" setup>
// 假设 AnalysisResult 是从后端返回的单个调试结果的数据结构
// 我们直接从后端返回的 result.data 来定义类型
interface DebugData {
  timestamp: number
  status: 'completed' | 'night'
  sea_blueness: number | null
  cloud_coverage: number | null
  output_directory: string
}

const props = defineProps<{
  result: DebugData
  apiUrl: string
}>()

const dayjs = useDayjs()

// 定义所有需要展示的调试图片文件名
const imageFilenames = [
  '01_downloaded_cropped.png',
  '02_generated_mask.png',
  '03_ocean_only.png',
  '04_cloud_mask.png',
  '05_cloud_free.png',
  '05_raw_blue_mask.png',
  '06_final_blue_ocean_mask.png',
]

// 格式化数据，使其更易读
const formattedData = computed(() => [
  { label: '时间', value: dayjs.unix(props.result.timestamp).format('YYYY-MM-DD HH:mm:ss') },
  { label: '状态', value: props.result.status },
  { label: '海蓝程度', value: props.result.sea_blueness !== null ? `${(props.result.sea_blueness * 100).toFixed(4)}%` : 'N/A' },
  { label: '云层覆盖率', value: props.result.cloud_coverage !== null ? `${(props.result.cloud_coverage * 100).toFixed(4)}%` : 'N/A' },
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
              class="h-auto w-full transition-transform duration-300 object-cover hover:scale-105"
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

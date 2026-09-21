<script lang="ts" setup>
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'

const props = defineProps<{
  result: AnalysisResult
  apiUrl: string
}>()

interface PipelineImage {
  filename: string
  label: string
  description: string
  legend?: Array<{ label: string, color: string }>
}

// 后端 (aqua-chroma) pipeline 各阶段生成的调试图
const pipelineImages: PipelineImage[] = [
  { filename: '01_input_processed.png', label: '原始输入', description: '预处理放大后的干净输入图（分析口径）' },
  { filename: '01_input_annotated.png', label: '地理标注', description: '叠加陆地边界与城市点位' },
  { filename: '02_auto_balanced.png', label: '色彩均衡', description: 'CLAHE 亮度与对比度增强' },
  { filename: '03_ocean_only.png', label: '海域提取', description: '按 GeoJSON 蒙版遮蔽陆地' },
  {
    filename: '04_hsv_classification.png',
    label: 'HSV 分类',
    description: '按 HSV 阈值划分云 / 蓝水 / 黄水',
    legend: [
      { label: '云', color: '#ffffff' },
      { label: '蓝水', color: '#00598a' },
      { label: '黄水', color: '#a17509' },
    ],
  },
]

const statusLabels: Record<AnalysisResult['status'], string> = {
  completed: '已完成',
  night: '夜间',
}

const hasImages = computed(() => props.result.status === 'completed')

const formattedData = computed(() => [
  { label: '时间', value: format(fromUnixTime(props.result.timestamp), 'yyyy-MM-dd HH:mm:ss') },
  { label: '状态', value: statusLabels[props.result.status] ?? props.result.status },
  { label: '海蓝程度', value: props.result.sea_blueness !== null ? `${(props.result.sea_blueness * 100).toFixed(4)}%` : 'N/A' },
  { label: '云层覆盖率', value: props.result.cloud_coverage !== null ? `${(props.result.cloud_coverage * 100).toFixed(4)}%` : 'N/A' },
])

// 历史数据可能缺少后新增的调试图（如 01_input_annotated），加载失败时以占位符代替
const failedImages = ref<Record<string, boolean>>({})

const previewList = computed(() =>
  pipelineImages
    .filter(img => !failedImages.value[img.filename])
    .map(img => ({ src: `${props.apiUrl}/${props.result.output_directory}/${img.filename}`, alt: img.label, filename: img.filename })))

const isPreviewOpen = ref(false)
const previewIndex = ref(0)

function openPreview(filename: string) {
  previewIndex.value = Math.max(previewList.value.findIndex(p => p.filename === filename), 0)
  isPreviewOpen.value = true
}
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

    <!-- 处理流程图像展示 -->
    <div>
      <h3 class="text-lg text-gray-800 font-semibold mb-3 dark:text-gray-200">
        处理流程
      </h3>

      <div v-if="!hasImages" class="text-gray-400 py-12 border rounded-lg border-dashed flex flex-col gap-2 items-center dark:border-gray-600">
        <div class="i-carbon-moon h-8 w-8" />
        <span class="text-sm">该时间点为夜间，未生成分析图像</span>
      </div>

      <template v-else>
        <div class="gap-4 grid grid-cols-2 sm:grid-cols-3">
          <div v-for="img in pipelineImages" :key="img.filename">
            <div class="border rounded-md bg-gray-100 overflow-hidden dark:border-gray-700 dark:bg-gray-700">
              <img
                v-if="!failedImages[img.filename]"
                :src="`${apiUrl}/${result.output_directory}/${img.filename}`"
                :alt="img.label"
                loading="lazy"
                decoding="async"
                class="w-full aspect-square cursor-zoom-in transition-transform duration-300 object-cover hover:scale-105"
                @error="failedImages[img.filename] = true"
                @click="openPreview(img.filename)"
              >
              <div v-else class="text-gray-400 flex flex-col gap-2 aspect-square items-center justify-center">
                <div class="i-carbon-image h-6 w-6" />
                <span class="text-xs">图片缺失</span>
              </div>
            </div>
            <div class="py-1.5">
              <p class="text-sm text-gray-700 font-medium text-center dark:text-gray-300">
                {{ img.label }}
              </p>
              <p class="text-xs text-gray-400 mt-0.5 text-center">
                {{ img.description }}
              </p>
              <div v-if="img.legend" class="mt-1.5 flex flex-wrap gap-3 justify-center">
                <span v-for="dot in img.legend" :key="dot.label" class="text-xs text-gray-500 flex gap-1 items-center dark:text-gray-400">
                  <span
                    class="border border-gray-300 rounded-sm h-2.5 w-2.5 inline-block dark:border-gray-600"
                    :style="{ backgroundColor: dot.color }"
                  />
                  {{ dot.label }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <ImagePreview v-model:open="isPreviewOpen" :images="previewList" :initial-index="previewIndex" />
      </template>
    </div>
  </div>
</template>

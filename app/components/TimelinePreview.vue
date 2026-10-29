<script setup lang="ts">
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'

const props = defineProps<{
  /** 当前预览的分析记录；null 表示暂无可预览数据 */
  result: AnalysisResult | null
  apiUrl: string
}>()

const emit = defineEmits<{
  (e: 'open-detail', result: AnalysisResult): void
}>()

const views = [
  {
    filename: '01_input_processed.png',
    label: '原图',
    hint: '原始输入',
    icon: 'i-carbon-image',
  },
  {
    filename: '01b_superresolved.png',
    label: '高清化',
    hint: 'Real-ESRGAN 4×',
    icon: 'i-carbon-zoom-in',
  },
  {
    filename: '04_hsv_classification.png',
    label: '分类结果',
    hint: '云 / 蓝水 / 黄水',
    icon: 'i-carbon-color-palette',
  },
]

const previewOpen = ref(false)
const previewIndex = ref(0)

// 切换预览时刻时重置加载失败状态，让新记录重新尝试加载图片
const failedImages = ref<Record<string, boolean>>({})
watch(() => props.result?.timestamp, () => {
  failedImages.value = {}
  previewOpen.value = false
})

const hasImages = computed(() => props.result?.status === 'completed' || props.result?.status === 'cloudy')

const timeLabel = computed(() =>
  props.result
    ? format(fromUnixTime(props.result.timestamp), 'yyyy-MM-dd HH:mm')
    : '--')

function imageUrl(filename: string) {
  return props.result
    ? `${props.apiUrl}/${props.result.output_directory}/${filename}`
    : ''
}

const availableImages = computed(() => {
  if (!props.result || !hasImages.value)
    return []
  return views
    .filter(view => !failedImages.value[view.filename])
    .map(view => ({
      src: imageUrl(view.filename),
      alt: `${view.label} · ${timeLabel.value}`,
      filename: view.filename,
    }))
})

function openPreview(filename: string) {
  previewIndex.value = Math.max(availableImages.value.findIndex(image => image.filename === filename), 0)
  previewOpen.value = true
}

const blueness = computed(() => {
  const value = props.result?.blueness_index ?? props.result?.sea_blueness
  return value == null
    ? null
    : value * 100
})
const cloud = computed(() => props.result?.cloud_coverage != null
  ? props.result.cloud_coverage * 100
  : null)
const visibility = computed(() => props.result?.visibility_km ?? null)
const haze = computed(() => props.result?.haze_score ?? null)

function formatPercent(value: number | null) {
  return value == null
    ? '--'
    : `${value.toFixed(1)}%`
}

const metrics = computed(() => [
  {
    label: '海蓝程度',
    value: formatPercent(blueness.value),
    sub: '',
    dot: '#3b82f6',
  },
  {
    label: '云层覆盖率',
    value: formatPercent(cloud.value),
    sub: '',
    dot: '#94a3b8',
  },
  {
    label: '能见度',
    value: visibility.value == null
      ? '--'
      : `${visibility.value.toFixed(1)} km`,
    sub: props.result?.visibility_level ?? '',
    dot: '#14b8a6',
  },
  {
    label: '大气浑浊度',
    value: haze.value == null
      ? '--'
      : haze.value.toFixed(2),
    sub: '',
    dot: '#f59e0b',
  },
])

const statusMeta = computed(() => {
  switch (props.result?.status) {
    case 'cloudy':
      return { label: '云层偏厚', class: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800' }
    case 'night':
      return { label: '夜间', class: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700' }
    default:
      return { label: '已完成', class: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800' }
  }
})

const shareLink = computed(() => props.result
  ? `/share?ts=${props.result.timestamp}`
  : '/share')

function openDetail() {
  if (props.result)
    emit('open-detail', props.result)
}
</script>

<template>
  <section class="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
    <header class="px-4 py-4 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between sm:px-5 dark:border-gray-700">
      <div class="flex gap-3 items-center">
        <div class="text-teal-600 rounded-xl bg-teal-50 flex h-9 w-9 items-center justify-center dark:text-teal-400 dark:bg-teal-900/30">
          <div class="i-carbon-tree-view-alt h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 class="text-base text-gray-800 font-semibold dark:text-gray-100">
            时间线三视图
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            悬停上方曲线，预览该时刻的原图、高清化与分类结果
          </p>
        </div>
      </div>

      <div v-if="result" class="flex flex-wrap gap-2 items-center">
        <span class="text-sm text-gray-600 font-mono px-2.5 py-1 border border-gray-200 rounded-lg bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:bg-gray-900/40">
          {{ timeLabel }}
        </span>
        <span class="text-xs font-medium px-2 py-1 rounded-full ring-1" :class="statusMeta.class">
          {{ statusMeta.label }}
        </span>
        <NuxtLink
          :to="shareLink"
          class="text-sm text-white px-3 py-1 rounded-lg bg-teal-600 flex gap-1 transition-colors items-center hover:bg-teal-700"
        >
          <div class="i-carbon-share h-3.5 w-3.5" aria-hidden="true" />
          生成图文
        </NuxtLink>
        <button
          class="text-sm text-teal-700 px-3 py-1 border border-teal-200 rounded-lg bg-teal-50/60 flex gap-1 transition-colors items-center dark:text-teal-300 dark:border-teal-800 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40"
          @click="openDetail"
        >
          <div class="i-carbon-arrow-right h-3.5 w-3.5" aria-hidden="true" />
          查看详情
        </button>
      </div>
    </header>

    <div v-if="result && hasImages" class="p-3 space-y-3 sm:p-5">
      <div class="gap-2 grid grid-cols-3 sm:gap-3">
        <figure v-for="view in views" :key="view.filename" class="min-w-0">
          <div class="rounded-xl bg-gray-900 aspect-square ring-1 ring-black/5 relative overflow-hidden dark:ring-white/10">
            <img
              v-if="!failedImages[view.filename]"
              :src="imageUrl(view.filename)"
              :alt="`${view.label} · ${timeLabel}`"
              loading="lazy"
              decoding="async"
              class="h-full w-full cursor-zoom-in transition-transform duration-300 object-cover hover:scale-[1.03]"
              @error="failedImages[view.filename] = true"
              @click="openPreview(view.filename)"
            >
            <div v-else class="text-gray-500 flex flex-col gap-1.5 h-full items-center justify-center">
              <div :class="view.icon" class="h-6 w-6" aria-hidden="true" />
              <span class="text-[10px] sm:text-xs">{{ view.label === '高清化' ? '该记录无高清化图' : '图片缺失' }}</span>
            </div>

            <span class="text-[10px] text-white px-1.5 py-0.5 rounded bg-black/55 left-1.5 top-1.5 backdrop-blur-sm sm:text-[11px] sm:left-2 sm:top-2">
              {{ view.label }}
            </span>
          </div>
          <figcaption class="text-[10px] text-gray-500 mt-1 text-center sm:text-xs dark:text-gray-400">
            {{ view.hint }}
          </figcaption>
        </figure>
      </div>

      <div class="gap-2 grid grid-cols-2 sm:grid-cols-4">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900/40"
        >
          <div class="text-[11px] text-gray-500 flex gap-1.5 items-center dark:text-gray-400">
            <span class="rounded-full h-1.5 w-1.5 inline-block" :style="{ backgroundColor: metric.dot }" />
            {{ metric.label }}
          </div>
          <div class="text-sm text-gray-800 font-mono font-semibold mt-0.5 dark:text-gray-100">
            {{ metric.value }}
            <span v-if="metric.sub" class="text-[10px] text-gray-400 font-normal font-sans ml-1">{{ metric.sub }}</span>
          </div>
        </div>
      </div>

      <ImagePreview v-model:open="previewOpen" :images="availableImages" :initial-index="previewIndex" />
    </div>

    <div v-else-if="result" class="text-gray-400 px-5 py-12 flex flex-col gap-2 items-center justify-center">
      <div class="i-carbon-moon h-8 w-8" aria-hidden="true" />
      <p class="text-sm">
        {{ result.status === 'night' ? '该时刻为夜间，未生成分析图像' : '该记录暂无可用图像' }}
      </p>
    </div>

    <div v-else class="text-gray-400 px-5 py-12 flex flex-col gap-2 items-center justify-center">
      <div class="i-carbon-cursor-1 h-8 w-8" aria-hidden="true" />
      <p class="text-sm">
        暂无可预览的数据
      </p>
      <p class="text-xs">
        加载完成后，悬停上方曲线即可查看对应时刻的三视图
      </p>
    </div>
  </section>
</template>

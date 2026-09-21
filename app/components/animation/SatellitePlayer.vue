<script lang="ts" setup>
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'

const props = defineProps<{
  urls: string[]
  frames: AnalysisResult[]
  currentIndex: number
  fps?: number
  /** 悬停预览帧索引（图表 hover 时临时接管显示），null 时回落到当前播放帧 */
  previewIndex?: number | null
}>()

// 淡化时长随播放速度自适应：高速播放时接近硬切，避免长时间停留在半透明中间态
const fadeDuration = computed(() => `${Math.max(40, Math.min(160, Math.floor(1000 / (props.fps ?? 4) * 0.6)))}ms`)

// 实际展示帧：预览优先，其次播放进度
const activeIndex = computed(() => props.previewIndex ?? props.currentIndex)

// 双层交叉淡入淡出
const layerASrc = shallowRef('')
const layerBSrc = shallowRef('')
const showA = shallowRef(true)

// 预加载：Map 按插入顺序淘汰旧图，控制内存占用
const MAX_CACHE = 240
const LOOKAHEAD = 16
const imageCache = new Map<string, HTMLImageElement>()

function getImage(url: string) {
  let img = imageCache.get(url)
  if (!img) {
    img = new Image()
    img.decoding = 'async'
    img.src = url
    imageCache.set(url, img)
    while (imageCache.size > MAX_CACHE) {
      const oldest = imageCache.keys().next().value
      if (oldest === undefined)
        break
      imageCache.delete(oldest)
    }
  }
  return img
}

// 解码门控：等待目标图片完成解码后再切换图层，避免播放中闪出空白/半加载画面。
// 世代令牌：快速换帧或拖动进度条时丢弃过期的解码结果，防止旧帧乱序切入。
let swapToken = 0

async function displayFrame(url: string) {
  const token = ++swapToken
  const img = getImage(url)
  try {
    await img.decode()
  }
  catch {
    return // 图片加载失败，保持当前画面
  }
  if (token !== swapToken)
    return // 已有更新的帧到达，放弃过期切换

  if (showA.value) {
    layerBSrc.value = url
    showA.value = false
  }
  else {
    layerASrc.value = url
    showA.value = true
  }
}

const currentUrl = computed(() => props.urls[activeIndex.value] ?? '')

watch(currentUrl, (url) => {
  if (!url)
    return
  // 预取当前帧与后续若干帧，保证播放流畅
  displayFrame(url)
  for (let i = 1; i <= LOOKAHEAD; i++) {
    const next = props.urls[activeIndex.value + i] ?? ''
    if (next)
      getImage(next)
  }
}, { immediate: true })

const currentItem = computed(() => props.frames[activeIndex.value] ?? null)

const seaBluenessLabel = computed(() =>
  currentItem.value?.sea_blueness != null ? `${(currentItem.value.sea_blueness * 100).toFixed(1)}%` : '--')
const cloudCoverageLabel = computed(() =>
  currentItem.value?.cloud_coverage != null ? `${(currentItem.value.cloud_coverage * 100).toFixed(1)}%` : '--')
</script>

<template>
  <div class="border border-gray-200 rounded-xl bg-gray-900 shadow-sm relative overflow-hidden dark:border-gray-700 dark:bg-black">
    <!-- 两层图片交叉淡入淡出 -->
    <img
      v-if="layerASrc"
      :src="layerASrc"
      alt="卫星图像"
      class="h-full w-full transition-opacity inset-0 absolute object-contain"
      :class="showA ? 'opacity-100' : 'opacity-0'"
      :style="{ transitionDuration: fadeDuration }"
    >
    <img
      v-if="layerBSrc"
      :src="layerBSrc"
      alt="卫星图像"
      class="h-full w-full transition-opacity inset-0 absolute object-contain"
      :class="showA ? 'opacity-0' : 'opacity-100'"
      :style="{ transitionDuration: fadeDuration }"
    >

    <!-- 无画面占位 -->
    <div v-if="!currentUrl" class="text-gray-500 flex flex-col gap-3 items-center inset-0 justify-center absolute">
      <div class="i-carbon-image h-10 w-10" />
      <span class="text-sm">暂无画面</span>
    </div>

    <!-- 覆盖信息层 -->
    <template v-if="currentItem">
      <div class="text-sm text-white font-mono px-2.5 py-1 rounded-md bg-black/50 left-3 top-3 backdrop-blur-sm">
        {{ format(fromUnixTime(currentItem.timestamp), 'yyyy-MM-dd HH:mm') }}
      </div>

      <div class="text-xs text-white/80 font-mono px-2.5 py-1 rounded-md bg-black/50 right-3 top-3 backdrop-blur-sm">
        {{ activeIndex + 1 }} / {{ frames.length }}
      </div>

      <div class="flex flex-wrap gap-2 bottom-3 left-3">
        <div class="text-sm text-white px-2.5 py-1 rounded-md bg-black/50 flex gap-1.5 items-center backdrop-blur-sm">
          <span class="rounded-full h-2 w-2 inline-block" style="background-color: #3b82f6" />
          海蓝程度
          <span class="font-bold font-mono">{{ seaBluenessLabel }}</span>
        </div>
        <div class="text-sm text-white px-2.5 py-1 rounded-md bg-black/50 flex gap-1.5 items-center backdrop-blur-sm">
          <span class="rounded-full bg-gray-400 h-2 w-2 inline-block" />
          云层覆盖率
          <span class="font-bold font-mono">{{ cloudCoverageLabel }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

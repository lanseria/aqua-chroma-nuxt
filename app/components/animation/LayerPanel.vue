<script lang="ts" setup>
import MapAnnotationOverlay from './MapAnnotationOverlay.vue'

const props = defineProps<{
  urls: string[]
  activeIndex: number
  fps?: number
  /** 多图层视图中显示在左上角的图层名 */
  label?: string
  /** 是否叠加陆地边界与城市标注 */
  annotated?: boolean
  /** 标注渲染配置（粗细、颜色、城市名等） */
  annotationConfig?: AnnotationConfig
}>()

// 淡化时长随播放速度自适应：高速播放时接近硬切，避免长时间停留在半透明中间态
const fadeDuration = computed(() => `${Math.max(40, Math.min(160, Math.floor(1000 / (props.fps ?? 4) * 0.6)))}ms`)

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

const currentUrl = computed(() => props.urls[props.activeIndex] ?? '')

watch(currentUrl, (url) => {
  if (!url)
    return
  // 预取当前帧与后续若干帧，保证播放流畅
  displayFrame(url)
  for (let i = 1; i <= LOOKAHEAD; i++) {
    const next = props.urls[props.activeIndex + i] ?? ''
    if (next)
      getImage(next)
  }
}, { immediate: true })
</script>

<template>
  <div class="h-full w-full relative overflow-hidden">
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

    <!-- 陆地边界与城市标注（叠加在画面之上，随 object-contain 图片对齐） -->
    <MapAnnotationOverlay v-if="annotated" :config="annotationConfig" />

    <!-- 图层名标记 -->
    <div
      v-if="label"
      class="text-xs text-white/80 px-2 py-0.5 rounded bg-black/50 left-1/2 top-2 backdrop-blur-sm -translate-x-1/2"
    >
      {{ label }}
    </div>
  </div>
</template>

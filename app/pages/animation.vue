<script setup lang="ts">
import { storeToRefs } from 'pinia'
import PlaybackControls from '~/components/animation/PlaybackControls.vue'
import PlaybackTrendChart from '~/components/animation/PlaybackTrendChart.vue'
import SatellitePlayer from '~/components/animation/SatellitePlayer.vue'
import { timeRangeOptions } from '~/constants'
import { useAnalysisStore } from '~/stores/analysis'

useHead({ title: '动画回放' })

const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.apiUrl

const analysisStore = useAnalysisStore()
const { results, loadingProgress } = storeToRefs(analysisStore)

// 默认 24 小时：帧数适中，适合一次完整循环
const selectedRange = ref(1)
const isFetching = ref(false)

// 播放帧：仅包含有图像的 completed 数据，按时间正序排列
const frames = computed(() =>
  results.value
    .filter(r => r.status === 'completed')
    .sort((a, b) => a.timestamp - b.timestamp))

const { currentIndex, isPlaying, fps, toggle, step, seek } = usePlayback(
  () => frames.value.length,
  { fps: 4 },
)

const currentFrame = computed(() => frames.value[currentIndex.value] ?? null)

// 图表悬停预览：非 null 时图片临时显示对应帧，移开后回落到播放进度
const previewIndex = shallowRef<number | null>(null)

// 图像图层：后端 (aqua-chroma) pipeline 生成的可视化图，默认原图
// （历史数据无 01b 高清化图，播放到对应帧时图片加载失败会显示暂无画面）
const imageLayerOptions = [
  { label: '原图', value: '01_input_processed.png' },
  { label: '高清化图', value: '01b_superresolved.png' },
  { label: '分类图', value: '04_hsv_classification.png' },
]
const activeLayer = ref(imageLayerOptions[0]!.value)

// 视图布局：single 单图层展示（默认），triple 三种图层同步展示
const viewLayout = ref<'single' | 'triple'>('single')

// 地图标注：叠加陆地边界与城市点位（对齐后端 01_input_annotated.png 的样式）
// 开关与样式配置均持久化到 localStorage，刷新后保持用户的查看偏好
const showAnnotation = useLocalStorage('aqua:annotation-show', false)
const annotationConfig = useLocalStorage('aqua:annotation-config', defaultAnnotationConfig)

function layerUrls(file: string) {
  return frames.value.map(f => `${apiUrl}/${f.output_directory}/${file}`)
}

// 播放器图层列表：单视图仅展示选中图层，三图同步展示全部图层
const playerLayers = computed(() => {
  if (viewLayout.value === 'triple')
    return imageLayerOptions.map(o => ({ label: o.label, urls: layerUrls(o.value) }))
  const active = imageLayerOptions.find(o => o.value === activeLayer.value)!
  return [{ label: active.label, urls: layerUrls(active.value) }]
})

async function handleRangeChange() {
  isFetching.value = true
  await analysisStore.fetchResults(Number(selectedRange.value))
  isFetching.value = false
}

// 键盘控制：空格播放/暂停，左右方向键逐帧步进
function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (target && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))
    return
  if (e.key === ' ') {
    e.preventDefault()
    toggle()
  }
  else if (e.key === 'ArrowLeft') {
    step(-1)
  }
  else if (e.key === 'ArrowRight') {
    step(1)
  }
}

onMounted(() => {
  handleRangeChange()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="space-y-4">
    <!-- 顶部控制栏：时间区间选择 -->
    <div class="flex flex-wrap gap-4 items-center justify-between">
      <h2 class="text-xl text-gray-800 font-bold dark:text-gray-100">
        动画回放
      </h2>
      <div class="flex gap-3 items-center">
        <div v-if="isFetching" class="i-carbon-circle-dash text-teal-600 h-4 w-4 animate-spin" />
        <ButtonGroup v-model="selectedRange" :options="timeRangeOptions" @change="handleRangeChange" />
      </div>
    </div>

    <template v-if="frames.length > 0">
      <!-- 播放器布局：画面在上铺满，控制台与时间轴组成底部一栏；移动端纵向堆叠（竖屏） -->
      <div class="flex flex-col gap-4 lg:h-[calc(100vh-300px)] lg:min-h-560px">
        <SatellitePlayer
          class="min-w-0 aspect-square lg:flex-1 lg:min-h-0 lg:aspect-auto"
          :layers="playerLayers"
          :frames="frames"
          :current-index="currentIndex"
          :fps="fps"
          :preview-index="previewIndex"
          :annotated="showAnnotation"
          :annotation-config="annotationConfig"
        />

        <!-- 底部控制台：播放控制 + 时间轴曲线 -->
        <div class="gap-4 grid lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)] lg:items-center">
          <PlaybackControls
            v-model:fps="fps"
            v-model:layer="activeLayer"
            v-model:layout="viewLayout"
            v-model:annotation="showAnnotation"
            v-model:config="annotationConfig"
            :is-playing="isPlaying"
            :frame-count="frames.length"
            :current-index="currentIndex"
            :current-time="currentFrame?.timestamp"
            :layer-options="imageLayerOptions"
            @toggle-play="toggle"
            @step="step"
            @seek="seek"
          />

          <PlaybackTrendChart
            class="h-240px min-w-0 lg:h-210px"
            :frames="frames"
            :current-index="currentIndex"
            @preview="previewIndex = $event"
            @preview-end="previewIndex = null"
            @seek="seek"
          />
        </div>
      </div>
    </template>

    <template v-else>
      <div v-if="isFetching" class="text-gray-500 py-20 flex flex-col gap-2 items-center">
        <div class="i-carbon-circle-dash text-teal-600 h-8 w-8 animate-spin" />
        <div class="text-xs font-mono">
          已加载 {{ loadingProgress }} 条数据...
        </div>
      </div>
      <div v-else class="text-gray-400 py-20 text-center">
        暂无分析数据
      </div>
    </template>
  </div>
</template>

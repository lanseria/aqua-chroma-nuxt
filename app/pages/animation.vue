<script setup lang="ts">
import { format, subDays } from 'date-fns'
import { storeToRefs } from 'pinia'
import PlaybackControls from '~/components/animation/PlaybackControls.vue'
import PlaybackTrendChart from '~/components/animation/PlaybackTrendChart.vue'
import SatellitePlayer from '~/components/animation/SatellitePlayer.vue'
import { timeRangeOptions } from '~/constants'
import { useAnalysisStore } from '~/stores/analysis'
import { dayWindow, todayString } from '~/utils/date-window'

useHead({ title: '动画回放' })

const toast = useToast()

const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.apiUrl

const analysisStore = useAnalysisStore()
const { results, loadingProgress } = storeToRefs(analysisStore)

// 默认 24 小时：帧数适中，适合一次完整循环
const selectedRange = ref(1)
const isFetching = ref(false)

// 播放帧：completed 与 cloudy 记录都有完整图像（状态只是数据库质量标签），一并纳入避免时间轴出现空洞
const allFrames = computed(() =>
  results.value
    .filter(r => r.status === 'completed' || r.status === 'cloudy')
    .sort((a, b) => a.timestamp - b.timestamp))

// --- 日期查找：把回放帧序列限定到指定自然日的 24 小时 ---
const focusDateInput = ref('')
const focusDate = ref<string | null>(null)

// 图表悬停预览：非 null 时图片临时显示对应帧，移开后回落到播放进度
const previewIndex = shallowRef<number | null>(null)

// 聚焦时只回放该自然日 00:00–24:00 内的帧；清除后恢复全量
const frames = computed(() => {
  if (!focusDate.value)
    return allFrames.value
  const { start, end } = dayWindow(focusDate.value)
  return allFrames.value.filter(f => f.timestamp >= start && f.timestamp < end)
})

// 聚焦日帧摘要：帧数与当日实际覆盖的时间跨度
const focusStats = computed(() => {
  if (!focusDate.value || frames.value.length === 0)
    return null
  const first = frames.value[0]!
  const last = frames.value[frames.value.length - 1]!
  return {
    count: frames.value.length,
    firstTime: format(first.timestamp * 1000, 'HH:mm'),
    lastTime: format(last.timestamp * 1000, 'HH:mm'),
  }
})

function handleFocusDate() {
  const date = focusDateInput.value
  if (!date) {
    toast.warning('请先选择要查找的日期')
    return
  }
  if (date > todayString()) {
    toast.warning('不能查找未来的日期')
    return
  }

  const { start, end } = dayWindow(date)
  const dayFrames = allFrames.value.filter(f => f.timestamp >= start && f.timestamp < end)

  if (dayFrames.length === 0) {
    const dayRecords = results.value.filter(r => r.timestamp >= start && r.timestamp < end)
    if (dayRecords.length > 0) {
      toast.info(`${date} 只有夜间/无画面记录，无法回放`)
    }
    else {
      // 服务端按「当前时间 − N 天」滚动截取，逐日无数据不代表超出范围
      const rangeStart = format(subDays(new Date(), Number(selectedRange.value)), 'yyyy-MM-dd')
      if (date < rangeStart)
        toast.warning(`${date} 超出当前已加载的 ${selectedRange.value} 天范围，请先切换更大的时间范围`)
      else
        toast.info(`${date} 暂无分析数据`)
    }
    return
  }

  // 聚焦后旧的悬停预览帧可能不属于新帧序列，先清空
  previewIndex.value = null
  focusDate.value = date
}

function clearFocusDate() {
  previewIndex.value = null
  focusDate.value = null
  focusDateInput.value = ''
}

const { currentIndex, isPlaying, fps, toggle, step, seek } = usePlayback(
  () => frames.value.length,
  { fps: 4 },
)

const currentFrame = computed(() => frames.value[currentIndex.value] ?? null)

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
  // 切换时间范围会重新拉取数据，先退出日期聚焦，避免对新数据套用旧日期
  previewIndex.value = null
  focusDate.value = null
  focusDateInput.value = ''
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
    <!-- 顶部控制栏：日期查找 + 时间区间选择 -->
    <div class="flex flex-wrap gap-4 items-center justify-between">
      <h2 class="text-xl text-gray-800 font-bold dark:text-gray-100">
        动画回放
      </h2>
      <div class="flex flex-wrap gap-3 items-center">
        <!-- 聚焦状态：帧数与当日实际覆盖的时间跨度 -->
        <div
          v-if="focusDate && focusStats"
          class="text-sm text-teal-700 px-2.5 py-1 border border-teal-200 rounded-lg bg-teal-50/70 flex gap-1 items-center dark:text-teal-400 dark:border-teal-800 dark:bg-teal-900/20"
        >
          <span class="i-carbon-search-locate h-4 w-4" />
          <span class="font-medium">{{ focusDate }}</span>
          <span class="text-gray-500 dark:text-gray-400">· {{ focusStats.count }} 帧 · {{ focusStats.firstTime }}–{{ focusStats.lastTime }}</span>
        </div>

        <div class="flex flex-wrap gap-2 items-center">
          <label for="animation-focus-date" class="text-sm text-gray-600 flex gap-1 items-center dark:text-gray-300">
            <span class="i-carbon-calendar h-4 w-4" />
            日期查找
          </label>
          <input
            id="animation-focus-date"
            v-model="focusDateInput"
            type="date"
            :max="todayString()"
            :disabled="isFetching"
            title="输入日期后点击定位，回放将聚焦到该日 24 小时"
            class="text-sm px-3 py-1.5 border border-gray-300 rounded bg-white dark:text-gray-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-teal-500"
            @keydown.enter="handleFocusDate"
          >
          <button
            class="text-sm text-white px-3 py-1.5 rounded bg-teal-600 flex gap-1.5 transition-colors items-center hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isFetching"
            @click="handleFocusDate"
          >
            <div class="i-carbon-search h-4 w-4" />
            定位
          </button>
          <button
            v-if="focusDate"
            class="text-sm text-gray-600 px-3 py-1.5 border border-gray-300 rounded bg-white flex gap-1.5 transition-colors items-center dark:text-gray-300 dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="clearFocusDate"
          >
            <div class="i-carbon-close h-4 w-4" />
            恢复全览
          </button>
        </div>

        <div v-if="isFetching" class="i-carbon-circle-dash text-teal-600 h-4 w-4 animate-spin" />
        <ButtonGroup v-model="selectedRange" :options="timeRangeOptions" @change="handleRangeChange" />
      </div>
    </div>

    <!-- 读屏播报：常驻 live region，聚焦状态变化时播报 -->
    <p class="sr-only" role="status">
      {{ focusDate ? `已聚焦 ${focusDate}，共 ${focusStats?.count ?? 0} 帧` : '' }}
    </p>

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
            :zoom-reset-key="focusDate"
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

<script setup lang="ts">
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime, parseISO, startOfDay, subDays } from 'date-fns'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { storeToRefs } from 'pinia'
import DebugResultViewer from '~/components/DebugResultViewer.vue'
import { timeRangeOptions } from '~/constants'
import { useAnalysisStore } from '~/stores/analysis'
import { dayWindow, todayString } from '~/utils/date-window'

const toast = useToast()
// URL
const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.apiUrl
const isNetlify = runtimeConfig.public.platform === 'netlify'

const analysisStore = useAnalysisStore()
const { results, loadingProgress } = storeToRefs(analysisStore)

// --- 数据筛选与加载 ---
const INITIAL_LOAD_COUNT = 12
const LOAD_MORE_COUNT = 8

const selectedRange = ref(7)
const isFetching = ref(false)

// --- 日期查找：输入日期后把趋势图范围缩小到该自然日的 24 小时 ---
const focusDateInput = ref('')
const focusDate = ref<string | null>(null)

const displayedCount = ref(INITIAL_LOAD_COUNT)
const isLoadingMore = ref(false)
const allDataLoaded = computed(() => displayedCount.value >= results.value.length)

// cloudy 记录同样有图像与指标（卡片带"云量过高"标记），night 无分析结果不展示
const displayedResults = computed(() => results.value.filter(m => m.status === 'completed' || m.status === 'cloudy').slice(0, displayedCount.value))

async function handleRangeChange(val: string | number | boolean) {
  const days = Number(val)
  displayedCount.value = INITIAL_LOAD_COUNT
  isFetching.value = true
  // 切换时间范围会重新拉取数据，先退出日期聚焦，避免对新数据套用旧日期
  focusDate.value = null
  focusDateInput.value = ''
  await analysisStore.fetchResults(days)
  isFetching.value = false
}

function loadMore() {
  if (isLoadingMore.value || allDataLoaded.value)
    return

  isLoadingMore.value = true
  setTimeout(() => {
    displayedCount.value += LOAD_MORE_COUNT
    isLoadingMore.value = false
  }, 500)
}

function handleScroll() {
  const buffer = 200
  const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - buffer
  if (isAtBottom)
    loadMore()
}

// 聚焦日内的统计摘要：记录数、图表有效点、海蓝/云量/能见度均值
const focusStats = computed(() => {
  if (!focusDate.value)
    return null

  const { start, end } = dayWindow(focusDate.value)
  const items = results.value.filter(r => r.timestamp >= start && r.timestamp < end)
  const chartItems = items.filter(r => r.sea_blueness !== null || r.visibility_km !== null)

  const blueness = chartItems
    .map(r => r.blueness_index ?? r.sea_blueness)
    .filter((v): v is number => v !== null && v !== undefined)
    .map(v => v * 100)
  const cloud = chartItems
    .map(r => r.cloud_coverage)
    .filter((v): v is number => v !== null)
    .map(v => v * 100)
  // 云层遮蔽记录的能见度按口径记 0（占位值），计算均值时排除，避免明显低估
  const visibility = chartItems
    .filter(r => r.visibility_level !== '云层遮蔽')
    .map(r => r.visibility_km)
    .filter((v): v is number => v !== null)

  const avg = (list: number[]) => list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : null

  return {
    records: items.length,
    points: chartItems.length,
    avgBlueness: avg(blueness),
    maxBlueness: blueness.length ? Math.max(...blueness) : null,
    avgCloud: avg(cloud),
    avgVisibility: avg(visibility),
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
  const items = results.value.filter(r => r.timestamp >= start && r.timestamp < end)
  const hasChartData = items.some(r => r.sea_blueness !== null || r.visibility_km !== null)

  if (!hasChartData) {
    if (items.length > 0) {
      toast.info(`${date} 只有夜间/无有效指标记录，无法绘制趋势曲线`)
    }
    else {
      // 服务端按「当前时间 − N 天」滚动截取，逐日无数据不代表超出范围
      const rangeStart = format(subDays(new Date(), Number(selectedRange.value)), 'yyyy-MM-dd')
      if (date < rangeStart) {
        toast.warning(`${date} 超出当前已加载的 ${selectedRange.value} 天范围，请先切换更大的时间范围`)
      }
      else {
        toast.info(`${date} 暂无分析数据`)
      }
    }
    return
  }

  focusDate.value = date
}

function clearFocusDate() {
  focusDate.value = null
  focusDateInput.value = ''
}

// 删除记录等操作可能让聚焦日不再有数据，此时自动退出聚焦，避免图表空白
watch(focusStats, (stats) => {
  if (focusDate.value && (!stats || stats.points === 0))
    focusDate.value = null
})

// 调试工具的状态
const debugTimestampInput = ref('')
const debugToolRef = ref<HTMLElement | null>(null)

// 详情弹窗状态（卡片点击与单点调试共用）
const isDetailModalOpen = ref(false)
const detailResult = ref<AnalysisResult | null>(null)

const detailModalTitle = computed(() =>
  detailResult.value
    ? `分析详情 · ${format(fromUnixTime(detailResult.value.timestamp), 'yyyy-MM-dd HH:mm:ss')}`
    : '分析详情')

function handleOpenDetail(item: AnalysisResult) {
  detailResult.value = item
  isDetailModalOpen.value = true
}

function handleDelete(item: AnalysisResult) {
  analysisStore.deleteResult(item.timestamp)
}

// --- 批量下载相关状态与逻辑 ---
const downloadStartDate = ref('')
const downloadEndDate = ref('')
const isDownloading = ref(false)

// 计算属性：将日期字符串转换为毫秒时间戳数组，兼容原有逻辑
const downloadDateRange = computed(() => {
  if (!downloadStartDate.value || !downloadEndDate.value)
    return []
  const start = startOfDay(parseISO(downloadStartDate.value)).getTime()
  const end = startOfDay(parseISO(downloadEndDate.value)).getTime()
  return [start, end]
})

function formatSrtTime(seconds: number) {
  const pad = (num: number, size: number) => num.toString().padStart(size, '0')
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},000`
}

async function handleBatchDownload() {
  if (!downloadDateRange.value || downloadDateRange.value.length !== 2) {
    toast.warning('请先选择下载的时间范围')
    return
  }

  isDownloading.value = true
  const loadingId = toast.loading(`正在处理数据...`)
  const zip = new JSZip()

  const folderInput = zip.folder('01_input_processed')
  const folderHsv = zip.folder('04_hsv_classification')

  const startTs = Math.floor(downloadDateRange.value[0]! / 1000)
  const endTs = Math.floor(downloadDateRange.value[1]! / 1000) + 86399

  const targetItems = results.value
    .filter(item => item.timestamp >= startTs && item.timestamp <= endTs && (item.status === 'completed' || item.status === 'cloudy'))
    .sort((a, b) => a.timestamp - b.timestamp)

  if (targetItems.length === 0) {
    toast.remove(loadingId)
    toast.info('该时间段内没有可下载的数据')
    isDownloading.value = false
    return
  }

  try {
    let srtContent = ''

    const promises = targetItems.map(async (item) => {
      const inputUrl = `${apiUrl}/${item.output_directory}/01_input_processed.png`
      const hsvUrl = `${apiUrl}/${item.output_directory}/04_hsv_classification.png`

      try {
        const [inputBlob, hsvBlob] = await Promise.all([
          fetch(inputUrl).then(res => res.blob()),
          fetch(hsvUrl).then(res => res.blob()),
        ])

        folderInput?.file(`${item.timestamp}.png`, inputBlob)
        folderHsv?.file(`${item.timestamp}.png`, hsvBlob)
      }
      catch (err) {
        console.warn(`下载图片失败: ${item.timestamp}`, err)
      }
    })

    await Promise.all(promises)

    targetItems.forEach((item, index) => {
      const seq = index + 1
      const startTime = formatSrtTime(index)
      const endTime = formatSrtTime(index + 1)
      const timeDisplay = format(fromUnixTime(item.timestamp), 'yyyy-MM-dd HH:mm')

      srtContent += `${seq}\n${startTime} --> ${endTime}\n${timeDisplay}\n\n`
    })

    zip.file('timeline.srt', srtContent)

    const content = await zip.generateAsync({ type: 'blob' })
    const dateStr = new Date().toISOString().split('T')[0]
    saveAs(content, `aqua-chroma-dataset-${dateStr}.zip`)
    toast.success('打包下载成功')
  }
  catch (error) {
    console.error('批量下载失败:', error)
    toast.error('打包下载过程中发生错误')
  }
  finally {
    toast.remove(loadingId)
    isDownloading.value = false
  }
}

function handleTimestampSelected(timestamp: number) {
  debugTimestampInput.value = String(timestamp)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleTriggerDebug() {
  if (!debugTimestampInput.value) {
    toast.warning('请输入有效的时间戳')
    return
  }
  const timestamp = +debugTimestampInput.value
  if (Number.isNaN(timestamp)) {
    toast.error('时间格式无效，请输入 Unix 时间戳')
    return
  }

  const matched = results.value.find(r => r.timestamp === timestamp)
  if (!matched) {
    toast.error('未找到该时间戳的历史数据，请确认时间戳是否正确')
    return
  }

  handleOpenDetail(matched)
}

onMounted(async () => {
  await analysisStore.fetchResults(selectedRange.value)
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="p-4 sm:p-6">
    <div class="mb-6 space-y-4">
      <!-- 顶部控制栏：日期查找 + 时间筛选 -->
      <div class="flex flex-wrap gap-4 items-center justify-between">
        <h2 class="text-xl text-gray-800 font-bold dark:text-gray-100">
          趋势概览
        </h2>
        <div class="flex flex-wrap gap-3 items-center">
          <div class="flex flex-wrap gap-2 items-center">
            <label
              for="trend-focus-date"
              class="text-sm text-gray-600 flex gap-1 items-center dark:text-gray-300"
            >
              <span class="i-carbon-calendar h-4 w-4" />
              日期查找
            </label>
            <input
              id="trend-focus-date"
              v-model="focusDateInput"
              type="date"
              :max="todayString()"
              :disabled="isFetching"
              title="输入日期后点击定位，趋势图将聚焦到该日 24 小时"
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
          <ButtonGroup v-model="selectedRange" :options="timeRangeOptions" @change="handleRangeChange" />
        </div>
      </div>

      <!-- 聚焦日 24 小时的数据摘要 -->
      <div
        v-if="focusDate && focusStats"
        class="text-sm text-gray-600 px-3 py-2 border border-teal-200 rounded-lg bg-teal-50/70 flex flex-wrap gap-x-4 gap-y-1 items-center dark:text-gray-300 dark:border-teal-800 dark:bg-teal-900/20"
      >
        <div class="text-teal-700 font-medium flex gap-1 items-center dark:text-teal-400">
          <span class="i-carbon-search-locate h-4 w-4" />
          已聚焦 {{ focusDate }} · 24 小时范围
        </div>
        <span>有效数据点 <b class="font-mono">{{ focusStats.points }}</b></span>
        <span v-if="focusStats.records > focusStats.points">另有 <b class="font-mono">{{ focusStats.records - focusStats.points }}</b> 条无指标记录</span>
        <span v-if="focusStats.avgBlueness !== null">海蓝均值 <b class="font-mono">{{ focusStats.avgBlueness.toFixed(1) }}%</b></span>
        <span v-if="focusStats.maxBlueness !== null">峰值 <b class="font-mono">{{ focusStats.maxBlueness.toFixed(1) }}%</b></span>
        <span v-if="focusStats.avgCloud !== null">云量均值 <b class="font-mono">{{ focusStats.avgCloud.toFixed(1) }}%</b></span>
        <span v-if="focusStats.avgVisibility !== null">能见度均值（不含遮蔽） <b class="font-mono">{{ focusStats.avgVisibility.toFixed(1) }} km</b></span>
      </div>

      <!-- 读屏播报：常驻 live region，聚焦状态变化时播报（region 需先存在，故不使用 v-if） -->
      <p class="sr-only" role="status">
        {{ focusDate ? `已聚焦 ${focusDate}，${focusStats?.points ?? 0} 个有效数据点` : '' }}
      </p>

      <div class="relative">
        <!-- 加载遮罩 -->
        <div v-if="isFetching" class="rounded-lg bg-white/60 flex flex-col gap-2 items-center inset-0 justify-center absolute z-10 backdrop-blur-sm dark:bg-gray-800/60">
          <div class="i-carbon-circle-dash text-teal-600 h-8 w-8 animate-spin" />
          <div class="text-xs text-gray-500 font-mono">
            已加载 {{ loadingProgress }} 条数据...
          </div>
        </div>
        <TrendChart :results="results" :focus-date="focusDate" @timestamp-selected="handleTimestampSelected" />
      </div>

      <div v-if="!isNetlify" ref="debugToolRef" class="p-3 border border-gray-200 rounded-lg bg-white flex flex-wrap gap-4 shadow-sm items-center dark:border-gray-700 dark:bg-gray-800">
        <!-- 原有的单点调试 -->
        <div class="flex gap-2 items-center">
          <span class="font-medium flex-none">单点调试:</span>
          <input
            v-model="debugTimestampInput"
            placeholder="输入时间戳"
            class="text-sm px-3 py-1.5 border border-gray-300 rounded bg-white w-40 dark:text-gray-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-teal-500"
          >
          <button
            class="text-sm text-white px-4 py-1.5 rounded bg-teal-600 flex gap-1.5 transition-colors items-center hover:bg-teal-700"
            @click="handleTriggerDebug"
          >
            <div class="i-carbon-debug h-4 w-4" />
            查看
          </button>
        </div>

        <div class="bg-gray-300 h-6 w-px hidden dark:bg-gray-600 sm:block" />

        <!-- 批量下载 -->
        <div class="flex gap-2 items-center">
          <span class="font-medium flex-none">数据集下载:</span>
          <input
            type="date"
            :value="downloadStartDate"
            :max="todayString()"
            class="text-sm px-3 py-1.5 border border-gray-300 rounded bg-white dark:text-gray-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-teal-500"
            @input="downloadStartDate = ($event.target as HTMLInputElement).value"
          >
          <span class="text-gray-400">至</span>
          <input
            type="date"
            :value="downloadEndDate"
            :max="todayString()"
            class="text-sm px-3 py-1.5 border border-gray-300 rounded bg-white dark:text-gray-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-teal-500"
            @input="downloadEndDate = ($event.target as HTMLInputElement).value"
          >
          <button
            class="text-sm text-teal-600 px-4 py-1.5 border-2 border-teal-600 rounded flex gap-1.5 transition-colors items-center dark:text-teal-500 dark:border-teal-500 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-teal-900/20"
            :disabled="isDownloading"
            @click="handleBatchDownload"
          >
            <div v-if="isDownloading" class="i-carbon-circle-dash h-4 w-4 animate-spin" />
            <div v-else class="i-carbon-download h-4 w-4" />
            打包下载
          </button>
        </div>
      </div>
    </div>
    <!-- 卡片网格布局 -->
    <div v-if="!isNetlify" class="gap-4 grid grid-cols-1 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
      <AnalysisCard v-for="item in displayedResults" :key="item.timestamp" :item="item" @open-detail="handleOpenDetail" @delete="handleDelete" />
    </div>

    <!-- 加载指示器 -->
    <template v-if="!isNetlify">
      <div v-if="isLoadingMore || !allDataLoaded" class="text-gray-500 py-8 text-center">
        <div v-if="isLoadingMore" class="flex items-center justify-center space-x-2">
          <div class="i-carbon-circle-dash h-6 w-6 animate-spin" />
          <span>加载中...</span>
        </div>
        <div v-else-if="!allDataLoaded">
          滚动以加载更多
        </div>
      </div>
      <div v-if="allDataLoaded && results.length > 0" class="text-gray-500 py-8 text-center">
        - 已加载全部内容 -
      </div>
      <div v-if="results.length === 0 && !isLoadingMore" class="text-gray-400 py-20 text-center">
        暂无分析数据
      </div>
    </template>

    <!-- 分析详情弹窗（卡片点击与单点调试共用） -->
    <AppModal v-model:open="isDetailModalOpen" :title="detailModalTitle" width="900px">
      <DebugResultViewer v-if="detailResult" :result="detailResult" :api-url="apiUrl" />
    </AppModal>
  </div>
</template>

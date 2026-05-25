<script setup lang="ts">
import { format, fromUnixTime, parseISO, startOfDay } from 'date-fns'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { storeToRefs } from 'pinia'
import DebugResultViewer from '~/components/DebugResultViewer.vue'
import { useAnalysisStore } from '~/stores/analysis'

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

// 定义时间范围选项
const timeRanges = [
  { label: '24小时', value: 1 },
  { label: '3天', value: 3 },
  { label: '7天', value: 7 },
  { label: '30天', value: 30 },
  { label: '1年', value: 365 },
]
const selectedRange = ref(7)
const isFetching = ref(false)

const displayedCount = ref(INITIAL_LOAD_COUNT)
const isLoadingMore = ref(false)
const allDataLoaded = computed(() => displayedCount.value >= results.value.length)

const displayedResults = computed(() => results.value.filter(m => m.status === 'completed').slice(0, displayedCount.value))

async function handleRangeChange(val: string | number | boolean) {
  const days = Number(val)
  displayedCount.value = INITIAL_LOAD_COUNT
  isFetching.value = true
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

// 调试工具的状态
const debugTimestampInput = ref('')
const debugToolRef = ref<HTMLElement | null>(null)

// 弹窗状态
const isDebugModalOpen = ref(false)
const debugResultData = ref<any>(null)

// --- 批量下载相关状态与逻辑 ---
const downloadStartDate = ref('')
const downloadEndDate = ref('')
const isDownloading = ref(false)

const today = format(new Date(), 'yyyy-MM-dd')

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
    .filter(item => item.timestamp >= startTs && item.timestamp <= endTs && item.status === 'completed')
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

  debugResultData.value = matched
  isDebugModalOpen.value = true
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
      <!-- 顶部控制栏：时间筛选 -->
      <div class="flex flex-wrap gap-4 items-center justify-between">
        <h2 class="text-xl text-gray-800 font-bold dark:text-gray-100">
          趋势概览
        </h2>
        <ButtonGroup v-model="selectedRange" :options="timeRanges" @change="handleRangeChange" />
      </div>

      <div class="relative">
        <!-- 加载遮罩 -->
        <div v-if="isFetching" class="rounded-lg bg-white/60 flex flex-col gap-2 items-center inset-0 justify-center absolute z-10 backdrop-blur-sm dark:bg-gray-800/60">
          <div class="i-carbon-circle-dash text-teal-600 h-8 w-8 animate-spin" />
          <div class="text-xs text-gray-500 font-mono">
            已加载 {{ loadingProgress }} 条数据...
          </div>
        </div>
        <TrendChart :results="results" @timestamp-selected="handleTimestampSelected" />
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
            :max="today"
            class="text-sm px-3 py-1.5 border border-gray-300 rounded bg-white dark:text-gray-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-teal-500"
            @input="downloadStartDate = ($event.target as HTMLInputElement).value"
          >
          <span class="text-gray-400">至</span>
          <input
            type="date"
            :value="downloadEndDate"
            :max="today"
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
      <AnalysisCard v-for="item in displayedResults" :key="item.timestamp" :item="item" @timestamp-selected="handleTimestampSelected" />
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

    <!-- 调试结果弹窗 -->
    <AppModal v-model:open="isDebugModalOpen" title="调试分析结果" width="900px">
      <DebugResultViewer v-if="debugResultData" :result="debugResultData" :api-url="apiUrl" />
    </AppModal>
  </div>
</template>

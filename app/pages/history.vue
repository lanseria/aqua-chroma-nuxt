<script setup lang="ts">
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime, parseISO, startOfDay } from 'date-fns'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { storeToRefs } from 'pinia'
import { timeRangeOptions } from '~/constants'
import { useAnalysisStore } from '~/stores/analysis'
import { todayString } from '~/utils/date-window'

useHead({ title: '历史记录' })

const toast = useToast()
const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.apiUrl
const isNetlify = runtimeConfig.public.platform === 'netlify'

const analysisStore = useAnalysisStore()
const { results, loadingProgress } = storeToRefs(analysisStore)

// --- 数据范围与分页 ---
const INITIAL_LOAD_COUNT = 12
const LOAD_MORE_COUNT = 8

const selectedRange = ref(7)
const isFetching = ref(true)
const displayedCount = ref(INITIAL_LOAD_COUNT)
const isLoadingMore = ref(false)

// cloudy 记录同样有图像与指标（卡片带"云量过高"标记），night 无分析结果不展示
const records = computed(() => results.value.filter(item => item.status === 'completed' || item.status === 'cloudy'))
const nightCount = computed(() => results.value.filter(item => item.status === 'night').length)
const displayedResults = computed(() => records.value.slice(0, displayedCount.value))
const allDataLoaded = computed(() => displayedCount.value >= records.value.length)

async function handleRangeChange(val: string | number | boolean) {
  displayedCount.value = INITIAL_LOAD_COUNT
  isFetching.value = true
  await analysisStore.fetchResults(Number(val))
  isFetching.value = false
}

async function refresh() {
  displayedCount.value = INITIAL_LOAD_COUNT
  isFetching.value = true
  await analysisStore.fetchResults(Number(selectedRange.value))
  isFetching.value = false
}

function loadMore() {
  if (isLoadingMore.value || allDataLoaded.value)
    return

  isLoadingMore.value = true
  setTimeout(() => {
    displayedCount.value += LOAD_MORE_COUNT
    isLoadingMore.value = false
  }, 400)
}

function handleScroll() {
  const buffer = 200
  const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - buffer
  if (isAtBottom)
    loadMore()
}

// --- 详情弹窗 ---
const isDetailModalOpen = ref(false)
const detailResult = ref<AnalysisResult | null>(null)

const detailModalTitle = computed(() =>
  detailResult.value
    ? `分析详情 · ${format(fromUnixTime(detailResult.value.timestamp), 'yyyy-MM-dd HH:mm:ss')}`
    : '分析详情')

function openDetail(item: AnalysisResult) {
  detailResult.value = item
  isDetailModalOpen.value = true
}

function handleDelete(item: AnalysisResult) {
  analysisStore.deleteResult(item.timestamp)
}

// --- 单点调试 ---
const debugTimestampInput = ref('')

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

  const matched = results.value.find(item => item.timestamp === timestamp)
  if (!matched) {
    toast.error('未找到该时间戳的历史数据，请确认时间戳是否正确')
    return
  }

  openDetail(matched)
}

// --- 批量下载 ---
const downloadStartDate = ref('')
const downloadEndDate = ref('')
const isDownloading = ref(false)

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

onMounted(async () => {
  isFetching.value = true
  await analysisStore.fetchResults(selectedRange.value)
  isFetching.value = false
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="space-y-5">
    <!-- 页头 -->
    <section class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <NuxtLink
          to="/"
          class="text-xs text-gray-500 flex gap-1 transition-colors items-center dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400"
        >
          <span class="i-carbon-arrow-left h-3.5 w-3.5" aria-hidden="true" />
          返回实时概览
        </NuxtLink>
        <h1 class="text-2xl text-gray-900 font-bold mt-1 dark:text-gray-100">
          历史记录
        </h1>
        <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
          <template v-if="isFetching">
            正在加载历史数据...
          </template>
          <template v-else>
            共 {{ records.length }} 条可浏览记录<span v-if="nightCount"> · {{ nightCount }} 条夜间记录无图像，未在此展示</span>
          </template>
        </p>
      </div>

      <div class="flex flex-wrap gap-2 items-center">
        <span class="text-xs text-gray-500 dark:text-gray-400">范围</span>
        <ButtonGroup v-model="selectedRange" :options="timeRangeOptions" @change="handleRangeChange" />
        <button
          class="text-sm text-gray-600 px-3 py-1.5 border border-gray-300 rounded-lg bg-white flex gap-1.5 transition-colors items-center dark:text-gray-300 dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700"
          :disabled="isFetching"
          @click="refresh"
        >
          <div class="i-carbon-renew h-4 w-4" :class="isFetching ? 'animate-spin' : ''" aria-hidden="true" />
          刷新
        </button>
      </div>
    </section>

    <!-- 数据工具 -->
    <section v-if="!isNetlify" class="gap-3 grid lg:grid-cols-2">
      <div class="p-4 border border-gray-200 rounded-xl bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="mb-3 flex gap-2 items-center">
          <div class="text-teal-600 rounded-lg bg-teal-50 flex h-8 w-8 items-center justify-center dark:text-teal-400 dark:bg-teal-900/30">
            <div class="i-carbon-debug h-4 w-4" aria-hidden="true" />
          </div>
          <h2 class="text-sm text-gray-800 font-semibold dark:text-gray-100">
            单点调试
          </h2>
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <input
            v-model="debugTimestampInput"
            placeholder="输入 Unix 时间戳（秒）"
            aria-label="Unix 时间戳"
            class="text-sm px-3 py-1.5 border border-gray-300 rounded-lg bg-white flex-1 min-w-40 dark:text-gray-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-teal-500"
          >
          <button
            class="text-sm text-white px-4 py-1.5 rounded-lg bg-teal-600 flex gap-1.5 transition-colors items-center hover:bg-teal-700"
            @click="handleTriggerDebug"
          >
            <div class="i-carbon-search h-4 w-4" aria-hidden="true" />
            查看
          </button>
        </div>
        <p class="text-xs text-gray-400 mt-2">
          输入某条记录的 Unix 时间戳，查看该时刻的完整处理流程与指标。
        </p>
      </div>

      <div class="p-4 border border-gray-200 rounded-xl bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div class="mb-3 flex gap-2 items-center">
          <div class="text-teal-600 rounded-lg bg-teal-50 flex h-8 w-8 items-center justify-center dark:text-teal-400 dark:bg-teal-900/30">
            <div class="i-carbon-download h-4 w-4" aria-hidden="true" />
          </div>
          <h2 class="text-sm text-gray-800 font-semibold dark:text-gray-100">
            数据集下载
          </h2>
        </div>
        <div class="flex flex-wrap gap-2 items-center">
          <input
            v-model="downloadStartDate"
            type="date"
            :max="todayString()"
            aria-label="下载开始日期"
            class="text-sm px-3 py-1.5 border border-gray-300 rounded-lg bg-white dark:text-gray-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-teal-500"
          >
          <span class="text-sm text-gray-400">至</span>
          <input
            v-model="downloadEndDate"
            type="date"
            :max="todayString()"
            aria-label="下载结束日期"
            class="text-sm px-3 py-1.5 border border-gray-300 rounded-lg bg-white dark:text-gray-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 focus:ring-2 focus:ring-teal-500"
          >
          <button
            class="text-sm text-teal-600 px-4 py-1.5 border-2 border-teal-600 rounded-lg flex gap-1.5 transition-colors items-center dark:text-teal-400 dark:border-teal-500 hover:bg-teal-50 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-teal-900/20"
            :disabled="isDownloading"
            @click="handleBatchDownload"
          >
            <div v-if="isDownloading" class="i-carbon-circle-dash h-4 w-4 animate-spin" aria-hidden="true" />
            <div v-else class="i-carbon-download h-4 w-4" aria-hidden="true" />
            打包下载
          </button>
        </div>
        <p class="text-xs text-gray-400 mt-2">
          打包原图、分类图与 timeline.srt（ZIP），仅包含有图像的记录。
        </p>
      </div>
    </section>

    <!-- 当前部署未启用历史浏览 -->
    <section
      v-if="isNetlify"
      class="text-gray-400 px-5 py-16 border border-gray-200 rounded-2xl border-dashed bg-white flex flex-col gap-2 items-center justify-center dark:border-gray-700 dark:bg-gray-800"
    >
      <div class="i-carbon-information h-8 w-8" aria-hidden="true" />
      <p class="text-sm">
        当前部署未启用历史记录浏览
      </p>
    </section>

    <!-- 记录卡片网格 -->
    <template v-else>
      <div v-if="isFetching && records.length === 0" class="text-gray-500 py-20 flex flex-col gap-2 items-center">
        <div class="i-carbon-circle-dash text-teal-600 h-8 w-8 animate-spin" aria-hidden="true" />
        <p class="text-xs font-mono">
          {{ loadingProgress > 0 ? `已加载 ${loadingProgress} 条数据...` : `正在加载 ${selectedRange} 天数据...` }}
        </p>
      </div>

      <div
        v-else-if="records.length === 0"
        class="text-gray-400 px-5 py-16 border border-gray-200 rounded-2xl border-dashed bg-white flex flex-col gap-2 items-center justify-center dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="i-carbon-catalog h-8 w-8" aria-hidden="true" />
        <p class="text-sm">
          暂无分析数据
        </p>
        <p class="text-xs">
          可以返回概览切换更大的时间范围
        </p>
      </div>

      <div v-else class="gap-4 grid grid-cols-1 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
        <AnalysisCard
          v-for="item in displayedResults"
          :key="item.timestamp"
          :item="item"
          @open-detail="openDetail"
          @delete="handleDelete"
        />
      </div>

      <div v-if="records.length > 0" class="text-gray-500 py-8 flex flex-col gap-2 items-center">
        <div v-if="isLoadingMore" class="flex gap-2 items-center">
          <div class="i-carbon-circle-dash h-5 w-5 animate-spin" aria-hidden="true" />
          <span class="text-sm">加载中...</span>
        </div>
        <template v-else-if="!allDataLoaded">
          <p class="text-xs text-gray-400">
            滚动到底部自动加载更多
          </p>
          <button
            class="text-sm text-teal-700 px-4 py-1.5 border border-teal-200 rounded-lg bg-teal-50/60 transition-colors dark:text-teal-300 dark:border-teal-800 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40"
            @click="loadMore"
          >
            加载更多
          </button>
        </template>
        <span v-else class="text-sm text-gray-400">
          - 已加载全部 {{ records.length }} 条记录 -
        </span>
      </div>
    </template>

    <!-- 分析详情弹窗 -->
    <AppModal v-model:open="isDetailModalOpen" :title="detailModalTitle" width="900px">
      <DebugResultViewer v-if="detailResult" :result="detailResult" :api-url="apiUrl" />
    </AppModal>
  </div>
</template>

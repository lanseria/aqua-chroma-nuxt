<script setup lang="ts">
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime, subDays } from 'date-fns'
import { storeToRefs } from 'pinia'
import { timeRangeOptions } from '~/constants'
import { useAnalysisStore } from '~/stores/analysis'
import { BLUENESS_LEVELS, bluenessLevelRange, chartResults, computeSeriesStats, VISIBILITY_MAX_KM } from '~/utils/analysis-metrics'
import { dayWindow, todayString } from '~/utils/date-window'

useHead({ title: '实时概览' })

const toast = useToast()
const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.apiUrl
const isNetlify = runtimeConfig.public.platform === 'netlify'

const analysisStore = useAnalysisStore()
const { results, loadingProgress } = storeToRefs(analysisStore)

// --- 数据筛选与加载 ---
const selectedRange = ref(7)
const isFetching = ref(true)

// --- 日期聚焦：把趋势图与指标摘要缩小到某个自然日的 24 小时 ---
const focusDateInput = ref('')
const focusDate = ref<string | null>(null)

// 悬停预览的时间戳；null 时回落到当前区间最新一条有效记录
const previewTimestamp = ref<number | null>(null)

const chartItems = computed(() => chartResults(results.value, focusDate.value))
const stats = computed(() => computeSeriesStats(chartItems.value))

const previewResult = computed(() => {
  if (previewTimestamp.value !== null) {
    const hit = chartItems.value.find(item => item.timestamp === previewTimestamp.value)
    if (hit)
      return hit
  }
  return chartItems.value[chartItems.value.length - 1] ?? null
})

const latestTimeLabel = computed(() =>
  stats.value.latest
    ? format(fromUnixTime(stats.value.latest.timestamp), 'MM-dd HH:mm')
    : '--')

const latestHint = computed(() => {
  const latest = stats.value.latest
  if (!latest)
    return '等待数据加载'
  const status = latest.status === 'cloudy'
    ? '云层偏厚'
    : '已完成'
  return `${format(fromUnixTime(latest.timestamp), 'MM-dd HH:mm')} · ${status}`
})

const cloudHint = computed(() =>
  stats.value.latestCloud == null
    ? '等待数据加载'
    : `最新 ${formatPercent(stats.value.latestCloud)}`)

const visibilityHint = computed(() => {
  const latest = stats.value.latest
  if (!latest)
    return '等待数据加载'
  if (latest.visibility_km == null)
    return '最新记录无能见度估算'
  return `最新 ${latest.visibility_km.toFixed(1)} km${latest.visibility_level
    ? ` · ${latest.visibility_level}`
    : ''}`
})

const visibilityProgress = computed(() =>
  stats.value.avgVisibility == null
    ? 0
    : (stats.value.avgVisibility / VISIBILITY_MAX_KM) * 100)

function formatPercent(value: number | null | undefined) {
  return value == null
    ? '--'
    : `${value.toFixed(1)}%`
}

async function handleRangeChange(val: string | number | boolean) {
  const days = Number(val)
  isFetching.value = true
  // 切换时间范围会重新拉取数据，先退出日期聚焦，避免对新数据套用旧日期
  focusDate.value = null
  focusDateInput.value = ''
  previewTimestamp.value = null
  await analysisStore.fetchResults(days)
  isFetching.value = false
}

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
  const dayRecords = results.value.filter(item => item.timestamp >= start && item.timestamp < end)
  const dayPoints = chartResults(results.value, date)

  if (dayPoints.length === 0) {
    if (dayRecords.length > 0) {
      toast.info(`${date} 只有夜间/无有效指标记录，无法绘制趋势曲线`)
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

  focusDate.value = date
  previewTimestamp.value = null
}

function clearFocusDate() {
  focusDate.value = null
  focusDateInput.value = ''
  previewTimestamp.value = null
}

// --- 详情弹窗：悬停预览与图表点击共用 ---
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

function handlePreview(timestamp: number) {
  previewTimestamp.value = timestamp
}

function handleTimestampSelected(timestamp: number) {
  const matched = results.value.find(item => item.timestamp === timestamp)
  if (matched)
    openDetail(matched)
}

onMounted(async () => {
  isFetching.value = true
  await analysisStore.fetchResults(selectedRange.value)
  isFetching.value = false
})
</script>

<template>
  <div class="space-y-5">
    <!-- 顶部概览：标题、实时状态、范围与日期聚焦 -->
    <section class="p-5 border border-teal-100 rounded-2xl relative overflow-hidden from-teal-50 to-sky-50 via-white bg-gradient-to-br sm:p-6 dark:border-teal-900/50 dark:from-teal-950/30 dark:to-sky-950/20 dark:via-gray-900">
      <div class="rounded-full bg-teal-200/40 h-48 w-48 pointer-events-none absolute blur-3xl dark:bg-teal-700/20 -right-12 -top-16" />
      <div class="rounded-full bg-sky-200/30 h-40 w-40 pointer-events-none left-1/3 absolute blur-3xl dark:bg-sky-800/10 -bottom-20" />

      <div class="flex flex-col gap-5 relative lg:flex-row lg:items-end lg:justify-between">
        <div class="max-w-2xl">
          <p class="text-xs text-teal-600 tracking-[0.2em] font-semibold uppercase dark:text-teal-400">
            Aqua Chroma · Live Overview
          </p>
          <h1 class="text-2xl text-gray-900 font-bold mt-1 sm:text-3xl dark:text-gray-100">
            海蓝之心观测台
          </h1>
          <p class="text-sm text-gray-500 leading-relaxed mt-1 dark:text-gray-400">
            汇总海蓝程度、云层覆盖率与能见度的多日趋势。悬停曲线即可预览对应时刻的原图、高清化与分类结果。
          </p>

          <div class="text-xs mt-3 flex flex-wrap gap-2 items-center">
            <span class="text-gray-600 px-2.5 py-1 rounded-full bg-white/70 flex gap-1.5 ring-1 ring-teal-100 items-center dark:text-gray-300 dark:bg-gray-800/70 dark:ring-teal-900">
              <span
                class="rounded-full h-1.5 w-1.5"
                :class="isFetching ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'"
              />
              {{ isFetching ? '正在更新数据' : '数据持续更新' }}
            </span>
            <span class="text-gray-600 px-2.5 py-1 rounded-full bg-white/70 flex gap-1.5 ring-1 ring-teal-100 items-center dark:text-gray-300 dark:bg-gray-800/70 dark:ring-teal-900">
              <span class="i-carbon-time text-gray-400 h-3.5 w-3.5" aria-hidden="true" />
              最新观测 {{ latestTimeLabel }}
            </span>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap gap-2 items-center">
            <span class="text-xs text-gray-500 dark:text-gray-400">范围</span>
            <ButtonGroup v-model="selectedRange" :options="timeRangeOptions" @change="handleRangeChange" />
          </div>

          <div class="flex flex-wrap gap-2 items-center">
            <label
              for="trend-focus-date"
              class="text-sm text-gray-600 flex gap-1.5 items-center dark:text-gray-300"
            >
              <span class="i-carbon-calendar text-gray-400 h-4 w-4" aria-hidden="true" />
              日期查找
            </label>
            <input
              id="trend-focus-date"
              v-model="focusDateInput"
              type="date"
              :max="todayString()"
              :disabled="isFetching"
              title="输入日期后点击定位，趋势图将聚焦到该日 24 小时"
              class="text-sm px-3 py-1.5 border border-gray-300 rounded-lg bg-white dark:text-gray-200 focus:outline-none dark:border-gray-600 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-teal-500"
              @keydown.enter="handleFocusDate"
            >
            <button
              class="text-sm text-white px-3 py-1.5 rounded-lg bg-teal-600 flex gap-1.5 transition-colors items-center hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="isFetching"
              @click="handleFocusDate"
            >
              <div class="i-carbon-search h-4 w-4" aria-hidden="true" />
              定位
            </button>
            <button
              v-if="focusDate"
              class="text-sm text-gray-600 px-3 py-1.5 border border-gray-300 rounded-lg bg-white flex gap-1.5 transition-colors items-center dark:text-gray-300 dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              @click="clearFocusDate"
            >
              <div class="i-carbon-close h-4 w-4" aria-hidden="true" />
              恢复全览
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 区间指标摘要 -->
    <section class="gap-3 grid grid-cols-2 xl:grid-cols-4">
      <MetricTile
        label="最新海蓝指数"
        :value="formatPercent(stats.latestBlueness)"
        :hint="latestHint"
        icon="i-carbon-wave-direction"
        accent="blue"
        :progress="stats.latestBlueness ?? 0"
      />
      <MetricTile
        label="区间峰值"
        :value="formatPercent(stats.maxBlueness)"
        :hint="`均值 ${formatPercent(stats.avgBlueness)} · ${stats.count} 个有效点`"
        icon="i-carbon-growth"
        accent="blue"
        :progress="stats.maxBlueness ?? 0"
      />
      <MetricTile
        label="平均云量"
        :value="formatPercent(stats.avgCloud)"
        :hint="cloudHint"
        icon="i-carbon-cloud"
        accent="slate"
        :progress="stats.avgCloud ?? 0"
      />
      <MetricTile
        label="平均能见度"
        :value="stats.avgVisibility == null ? '--' : `${stats.avgVisibility.toFixed(1)} km`"
        :hint="visibilityHint"
        icon="i-carbon-view"
        accent="teal"
        :progress="visibilityProgress"
      />
    </section>

    <!-- 趋势图 -->
    <section class="border border-gray-200 rounded-2xl bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <header class="px-4 py-4 border-b border-gray-100 sm:px-5 dark:border-gray-700">
        <div class="flex flex-wrap gap-3 items-start justify-between">
          <div>
            <div class="flex flex-wrap gap-2 items-center">
              <h2 class="text-base text-gray-800 font-semibold dark:text-gray-100">
                指标趋势
              </h2>
              <span
                v-if="focusDate"
                class="text-xs text-teal-700 px-2 py-0.5 rounded-full bg-teal-50 ring-1 ring-teal-200 dark:text-teal-300 dark:bg-teal-900/30 dark:ring-teal-800"
              >
                聚焦 {{ focusDate }}
              </span>
              <button
                v-if="focusDate"
                class="text-xs text-gray-500 px-2 py-0.5 border border-gray-200 rounded-full transition-colors dark:text-gray-400 hover:text-teal-600 dark:border-gray-600 dark:hover:text-teal-400"
                @click="clearFocusDate"
              >
                恢复全览
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-0.5 dark:text-gray-400">
              悬停曲线联动三视图 · 点击数据点查看详情 · 虚线为海蓝分级参考 · 能见度使用右侧 km 轴
            </p>
          </div>

          <div class="flex flex-wrap gap-2 items-center">
            <span class="text-xs text-gray-500 font-mono px-2 py-1 rounded-lg bg-gray-50 dark:text-gray-400 dark:bg-gray-900/40">
              {{ stats.count }} 个有效点
            </span>
            <NuxtLink
              v-if="!isNetlify"
              to="/history"
              class="text-sm text-teal-700 px-3 py-1.5 border border-teal-200 rounded-lg bg-teal-50/60 flex gap-1 transition-colors items-center dark:text-teal-300 dark:border-teal-800 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40"
            >
              历史记录
              <span class="i-carbon-arrow-right h-3.5 w-3.5" aria-hidden="true" />
            </NuxtLink>
          </div>
        </div>
      </header>

      <div class="p-3 relative sm:p-5">
        <div
          v-if="isFetching"
          class="rounded-xl bg-white/70 flex flex-col gap-2 items-center inset-0 justify-center absolute z-10 backdrop-blur-sm dark:bg-gray-800/70"
        >
          <div class="i-carbon-circle-dash text-teal-600 h-8 w-8 animate-spin" aria-hidden="true" />
          <p class="text-xs text-gray-500 font-mono dark:text-gray-400">
            {{ loadingProgress > 0 ? `已加载 ${loadingProgress} 条` : `正在加载 ${selectedRange} 天数据...` }}
          </p>
        </div>

        <div class="text-[11px] mb-2 flex flex-wrap gap-x-3 gap-y-1 items-center">
          <span class="text-gray-400 dark:text-gray-500">海蓝分级</span>
          <span
            v-for="level in BLUENESS_LEVELS"
            :key="level.name"
            class="text-[11px] flex gap-1 items-center"
          >
            <span class="border-t border-dashed h-0 w-4" :style="{ borderColor: level.color }" />
            <span class="font-medium" :style="{ color: level.color }">{{ level.name }}</span>
            <span class="text-gray-400 dark:text-gray-500">{{ bluenessLevelRange(level) }}</span>
          </span>
        </div>

        <TrendChart
          :results="results"
          :focus-date="focusDate"
          @preview="handlePreview"
          @timestamp-selected="handleTimestampSelected"
        />
      </div>
    </section>

    <!-- hover 时间线时联动更新的三视图 -->
    <TimelinePreview :result="previewResult" :api-url="apiUrl" @open-detail="openDetail" />

    <NuxtLink
      v-if="!isNetlify"
      to="/history"
      class="group p-4 border border-gray-200 rounded-2xl bg-white flex gap-4 shadow-sm transition-all items-center justify-between sm:p-5 dark:border-gray-700 hover:border-teal-300 dark:bg-gray-800 hover:shadow-md dark:hover:border-teal-700"
    >
      <div class="flex gap-3 items-center">
        <div class="text-teal-600 rounded-xl bg-teal-50 flex flex-none h-10 w-10 items-center justify-center dark:text-teal-400 dark:bg-teal-900/30">
          <div class="i-carbon-history h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p class="text-sm text-gray-800 font-medium dark:text-gray-100">
            浏览全部历史记录
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            逐条查看原始图像、分类结果与完整处理流程
          </p>
        </div>
      </div>
      <div class="i-carbon-arrow-right text-gray-300 flex-none h-5 w-5 transition-transform dark:text-gray-600 group-hover:text-teal-500 group-hover:translate-x-1" aria-hidden="true" />
    </NuxtLink>

    <!-- 分析详情弹窗 -->
    <AppModal v-model:open="isDetailModalOpen" :title="detailModalTitle" width="900px">
      <DebugResultViewer v-if="detailResult" :result="detailResult" :api-url="apiUrl" />
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import type { AnalysisResult } from '~/stores/analysis'
import type { PosterFormat, PosterSlide, PosterUrls } from '~/utils/share-poster'
import { format, fromUnixTime } from 'date-fns'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { storeToRefs } from 'pinia'
import { timeRangeOptions } from '~/constants'
import { useAnalysisStore } from '~/stores/analysis'
import { bluenessPercent, chartResults, getBluenessLevel } from '~/utils/analysis-metrics'
import { buildCaption, posterSize, renderPosterSet } from '~/utils/share-poster'

useHead({ title: '图文工坊' })

const toast = useToast()
const route = useRoute()
const router = useRouter()
const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.apiUrl

const analysisStore = useAnalysisStore()
const { results } = storeToRefs(analysisStore)

const selectedRange = ref(7)
const isFetching = ref(true)

const records = computed(() =>
  results.value
    .filter(item => item.status === 'completed' || item.status === 'cloudy')
    .sort((a, b) => b.timestamp - a.timestamp))

const selectedTimestamp = ref<number | null>(null)
const selectedResult = computed(() =>
  records.value.find(item => item.timestamp === selectedTimestamp.value) ?? null)

// 最近 120 条足够覆盖日常发布；若 URL 带入的记录更早，则临时插到列表最前面
const recordOptions = computed(() => {
  const recent = records.value.slice(0, 120)
  const selected = selectedResult.value
  if (selected && !recent.some(item => item.timestamp === selected.timestamp))
    return [selected, ...recent]
  return recent
})

const formatValue = ref<string>('9:16')
const posterFormat = computed<PosterFormat>(() => formatValue.value === '9:16'
  ? '9:16'
  : '3:4')
const formatOptions = [
  { label: '9:16 全屏', value: '9:16' },
  { label: '3:4 竖版', value: '3:4' },
]
const currentPosterSize = computed(() => posterSize(posterFormat.value))

// 海报图片标注：叠加海岸线与城市点位，默认开启，可关闭。
// 样式配置与动画回放页、首页三视图共用 aqua:annotation-config
const annotate = useLocalStorage('aqua:share-annotation-show', true)
const annotationConfig = useLocalStorage('aqua:annotation-config', defaultAnnotationConfig)

const slides: Array<{ key: PosterSlide, label: string, hint: string }> = [
  { key: 'cover', label: '封面', hint: '首图' },
  { key: 'triple', label: '三视图', hint: '原图 / 高清 / 分类' },
  { key: 'stats', label: '数据', hint: '走势与指标' },
]
const activeSlide = ref<PosterSlide>('cover')
const currentSlideLabel = computed(() => slides.find(slide => slide.key === activeSlide.value)?.label ?? '')

const slideUrls = ref<PosterUrls>({ cover: '', triple: '', stats: '' })
const activeUrl = computed(() => slideUrls.value[activeSlide.value])
const allReady = computed(() => Boolean(slideUrls.value.cover && slideUrls.value.triple && slideUrls.value.stats))

const isRendering = ref(false)
const isZipping = ref(false)
let renderToken = 0

const selectedLevel = computed(() =>
  selectedResult.value
    ? getBluenessLevel(bluenessPercent(selectedResult.value))
    : null)

const selectedTimeLabel = computed(() =>
  selectedResult.value
    ? format(fromUnixTime(selectedResult.value.timestamp), 'yyyy-MM-dd HH:mm')
    : '--')

const selectedBluenessLabel = computed(() =>
  selectedResult.value
    ? `${bluenessPercent(selectedResult.value).toFixed(1)}%`
    : '--')

const selectedCloudLabel = computed(() => {
  const value = selectedResult.value?.cloud_coverage
  return value == null
    ? '--'
    : `${(value * 100).toFixed(1)}%`
})

const selectedVisibilityLabel = computed(() => {
  const value = selectedResult.value?.visibility_km
  return value == null
    ? '--'
    : `${value.toFixed(1)} km`
})

const fileStamp = computed(() =>
  selectedResult.value
    ? format(fromUnixTime(selectedResult.value.timestamp), 'yyyyMMdd-HHmm')
    : 'aqua')

const trendSeries = computed(() => {
  const result = selectedResult.value
  if (!result)
    return { points: [] as AnalysisResult[], label: '综合海蓝指数走势' }

  const day = format(fromUnixTime(result.timestamp), 'yyyy-MM-dd')
  const sameDay = chartResults(results.value, day)
  if (sameDay.length >= 2)
    return { points: sameDay, label: '当日综合海蓝指数走势' }

  const nearby = chartResults(results.value)
    .filter(item => Math.abs(item.timestamp - result.timestamp) <= 12 * 3600)
  return { points: nearby, label: '邻近时刻综合海蓝指数走势' }
})

const captionDraft = ref('')

watch(selectedResult, (result) => {
  captionDraft.value = result
    ? buildCaption(result)
    : ''
})

watch(selectedTimestamp, (timestamp) => {
  if (timestamp == null)
    return
  router.replace({
    query: {
      ...route.query,
      ts: String(timestamp),
    },
  })
})

watch([
  selectedResult,
  posterFormat,
  annotate,
  annotationConfig,
], () => {
  void renderPosters()
})

function selectInitialRecord() {
  const queryTimestamp = Number(route.query.ts)
  const matched = Number.isFinite(queryTimestamp)
    ? records.value.find(item => item.timestamp === queryTimestamp)
    : null
  selectedTimestamp.value = matched?.timestamp ?? records.value[0]?.timestamp ?? null
}

async function handleRangeChange(val: string | number | boolean) {
  isFetching.value = true
  await analysisStore.fetchResults(Number(val))
  isFetching.value = false

  if (!selectedTimestamp.value || !records.value.some(item => item.timestamp === selectedTimestamp.value))
    selectInitialRecord()
}

function stepRecord(delta: number) {
  const index = records.value.findIndex(item => item.timestamp === selectedTimestamp.value)
  if (index < 0)
    return
  const next = records.value[index + delta]
  if (next)
    selectedTimestamp.value = next.timestamp
}

function randomRecord() {
  const pool = records.value.filter(item => item.timestamp !== selectedTimestamp.value)
  if (pool.length === 0)
    return
  selectedTimestamp.value = pool[Math.floor(Math.random() * pool.length)]!.timestamp
}

async function renderPosters() {
  const result = selectedResult.value
  if (!result) {
    slideUrls.value = { cover: '', triple: '', stats: '' }
    return
  }

  const token = ++renderToken
  isRendering.value = true

  try {
    const trend = trendSeries.value
    const urls = await renderPosterSet({
      result,
      trend: trend.points,
      trendLabel: trend.label,
      apiUrl,
      format: posterFormat.value,
      annotate: annotate.value,
      annotationConfig: annotationConfig.value,
    })

    if (token === renderToken)
      slideUrls.value = urls
  }
  catch (error) {
    console.error('生成分享海报失败:', error)
    if (token === renderToken)
      toast.error('生成海报失败，请稍后重试')
  }
  finally {
    if (token === renderToken)
      isRendering.value = false
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(',')
  if (!header || !base64)
    throw new Error('无效的图片数据')

  const mime = header.match(/data:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++)
    bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: mime })
}

function downloadSlide(slide: PosterSlide) {
  const url = slideUrls.value[slide]
  if (!url)
    return

  try {
    const label = slides.find(item => item.key === slide)?.label ?? '海报'
    saveAs(dataUrlToBlob(url), `aqua-chroma-${fileStamp.value}-${slide}.png`)
    toast.success(`已下载${label}海报`)
  }
  catch (error) {
    console.error('下载海报失败:', error)
    toast.error('下载海报失败')
  }
}

async function downloadAll() {
  if (!allReady.value || isRendering.value) {
    toast.warning('海报还在生成中，请稍候')
    return
  }

  isZipping.value = true
  const loadingId = toast.loading('正在打包图文...')

  try {
    const zip = new JSZip()
    zip.file('caption.txt', captionDraft.value)
    zip.file('01-cover.png', slideUrls.value.cover.split(',')[1]!, { base64: true })
    zip.file('02-triple.png', slideUrls.value.triple.split(',')[1]!, { base64: true })
    zip.file('03-stats.png', slideUrls.value.stats.split(',')[1]!, { base64: true })

    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, `aqua-chroma-post-${fileStamp.value}.zip`)
    toast.success('图文已打包下载')
  }
  catch (error) {
    console.error('打包图文失败:', error)
    toast.error('打包下载失败')
  }
  finally {
    toast.remove(loadingId)
    isZipping.value = false
  }
}

async function copyCaption() {
  if (!captionDraft.value)
    return

  try {
    await navigator.clipboard.writeText(captionDraft.value)
    toast.success('文案已复制')
  }
  catch {
    const textarea = document.createElement('textarea')
    textarea.value = captionDraft.value
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    toast.success('文案已复制')
  }
}

function resetCaption() {
  if (selectedResult.value)
    captionDraft.value = buildCaption(selectedResult.value)
}

onMounted(async () => {
  isFetching.value = true
  await analysisStore.fetchResults(selectedRange.value)
  isFetching.value = false
  selectInitialRecord()
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
          图文工坊
        </h1>
        <p class="text-sm text-gray-500 mt-1 dark:text-gray-400">
          选择观测时刻，生成适合抖音 / 小红书发布的 3:4 或 9:16 图文素材。
        </p>
      </div>

      <div class="flex flex-wrap gap-2 items-center">
        <span class="text-xs text-gray-500 dark:text-gray-400">数据范围</span>
        <ButtonGroup v-model="selectedRange" :options="timeRangeOptions" @change="handleRangeChange" />
      </div>
    </section>

    <!-- 选择观测时刻与画幅 -->
    <section class="p-4 border border-gray-200 rounded-2xl bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="gap-3 grid lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-end">
        <div class="min-w-0">
          <label for="share-record" class="text-xs text-gray-500 dark:text-gray-400">观测时刻</label>
          <select
            id="share-record"
            v-model.number="selectedTimestamp"
            :disabled="isFetching || records.length === 0"
            class="text-sm mt-1 px-3 py-2 border border-gray-300 rounded-lg bg-white w-full dark:text-gray-200 focus:outline-none dark:border-gray-600 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-teal-500"
          >
            <option v-for="record in recordOptions" :key="record.timestamp" :value="record.timestamp">
              {{ format(fromUnixTime(record.timestamp), 'MM-dd HH:mm') }} · 海蓝 {{ bluenessPercent(record).toFixed(1) }}%
            </option>
          </select>
        </div>

        <div>
          <span class="text-xs text-gray-500 dark:text-gray-400">画幅</span>
          <div class="mt-1">
            <ButtonGroup v-model="formatValue" :options="formatOptions" />
          </div>
        </div>

        <div>
          <span class="text-xs text-gray-500 dark:text-gray-400">图片标注</span>
          <div class="mt-1 flex gap-1.5 items-center">
            <button
              :aria-pressed="annotate"
              title="在封面与三视图的图片上叠加海岸线与城市标注"
              class="text-sm px-3 py-1.5 border rounded-lg cursor-pointer transition-colors duration-150"
              :class="annotate
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'"
              @click="annotate = !annotate"
            >
              {{ annotate ? '海岸线与城市' : '关闭' }}
            </button>
            <AnnotationSettings v-if="annotate" v-model:config="annotationConfig" />
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            class="text-sm text-gray-600 px-3 py-2 border border-gray-300 rounded-lg bg-white flex gap-1 transition-colors items-center dark:text-gray-300 dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="stepRecord(-1)"
          >
            <div class="i-carbon-chevron-up h-4 w-4" aria-hidden="true" />
            更新
          </button>
          <button
            class="text-sm text-gray-600 px-3 py-2 border border-gray-300 rounded-lg bg-white flex gap-1 transition-colors items-center dark:text-gray-300 dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="stepRecord(1)"
          >
            <div class="i-carbon-chevron-down h-4 w-4" aria-hidden="true" />
            更早
          </button>
          <button
            class="text-sm text-teal-700 px-3 py-2 border border-teal-200 rounded-lg bg-teal-50/60 flex gap-1 transition-colors items-center dark:text-teal-300 dark:border-teal-800 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40"
            @click="randomRecord"
          >
            <div class="i-carbon-shuffle h-4 w-4" aria-hidden="true" />
            随机
          </button>
        </div>
      </div>

      <div v-if="selectedResult && selectedLevel" class="text-xs mt-3 flex flex-wrap gap-x-4 gap-y-1 items-center">
        <span
          class="font-medium px-2 py-0.5 border rounded-full"
          :style="{ color: selectedLevel.color, borderColor: selectedLevel.color }"
        >
          {{ selectedLevel.name }}
        </span>
        <span class="text-gray-500 dark:text-gray-400">综合海蓝 <b class="text-gray-700 font-mono dark:text-gray-200">{{ selectedBluenessLabel }}</b></span>
        <span class="text-gray-500 dark:text-gray-400">云量 <b class="text-gray-700 font-mono dark:text-gray-200">{{ selectedCloudLabel }}</b></span>
        <span class="text-gray-500 dark:text-gray-400">能见度 <b class="text-gray-700 font-mono dark:text-gray-200">{{ selectedVisibilityLabel }}</b></span>
        <span class="text-gray-400 font-mono dark:text-gray-500">{{ selectedTimeLabel }}</span>
      </div>
    </section>

    <!-- 预览 + 文案下载 -->
    <div class="gap-5 grid xl:grid-cols-[minmax(0,1fr)_360px]">
      <section class="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">
        <div class="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center justify-between sm:px-5 dark:border-gray-700">
          <div class="p-1 rounded-lg bg-gray-100 flex gap-1 dark:bg-gray-900/50">
            <button
              v-for="slide in slides"
              :key="slide.key"
              class="text-sm px-3 py-1.5 rounded-md transition-colors"
              :class="activeSlide === slide.key
                ? 'bg-white text-teal-700 shadow-sm dark:bg-gray-700 dark:text-teal-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
              :aria-pressed="activeSlide === slide.key"
              @click="activeSlide = slide.key"
            >
              {{ slide.label }}
            </button>
          </div>
          <span class="text-xs text-gray-400 font-mono">
            {{ currentPosterSize.width }} × {{ currentPosterSize.height }} px
          </span>
        </div>

        <div class="p-3 sm:p-5">
          <div class="p-3 rounded-xl bg-gray-100 flex min-h-420px items-center justify-center relative dark:bg-gray-950/60">
            <img
              v-if="activeUrl && !isRendering"
              :src="activeUrl"
              :alt="`${currentSlideLabel}海报`"
              class="rounded-lg max-h-[70vh] w-auto shadow-2xl"
            >
            <div v-else class="text-gray-400 flex flex-col gap-2 items-center">
              <div class="i-carbon-circle-dash text-teal-600 h-8 w-8 animate-spin" aria-hidden="true" />
              <p class="text-sm">
                {{ isFetching ? '正在加载数据...' : '正在生成海报...' }}
              </p>
            </div>

            <div
              v-if="isRendering && activeUrl"
              class="rounded-xl bg-white/60 flex flex-col gap-2 items-center inset-0 justify-center absolute backdrop-blur-sm dark:bg-gray-900/60"
            >
              <div class="i-carbon-circle-dash text-teal-600 h-7 w-7 animate-spin" aria-hidden="true" />
              <p class="text-xs text-gray-500 font-mono dark:text-gray-400">
                重新生成中...
              </p>
            </div>
          </div>

          <p class="text-xs text-gray-400 mt-2 text-center">
            预览已按比例缩放，下载为 1080 × {{ currentPosterSize.height }} 高清 PNG。
          </p>
        </div>
      </section>

      <aside class="space-y-4">
        <!-- 发布文案 -->
        <section class="p-4 border border-gray-200 rounded-2xl bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div class="flex gap-2 items-center justify-between">
            <h2 class="text-sm text-gray-800 font-semibold dark:text-gray-100">
              发布文案
            </h2>
            <button
              class="text-xs text-teal-700 px-2.5 py-1 border border-teal-200 rounded-lg bg-teal-50/60 flex gap-1 transition-colors items-center dark:text-teal-300 dark:border-teal-800 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40"
              @click="copyCaption"
            >
              <div class="i-carbon-copy h-3.5 w-3.5" aria-hidden="true" />
              复制
            </button>
          </div>
          <textarea
            v-model="captionDraft"
            rows="11"
            aria-label="发布文案"
            class="text-sm leading-relaxed mt-3 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 w-full resize-y dark:text-gray-200 focus:outline-none dark:border-gray-700 dark:bg-gray-900/40 focus:ring-2 focus:ring-teal-500"
          />
          <div class="text-xs text-gray-400 mt-2 flex items-center justify-between">
            <span>{{ captionDraft.length }} 字</span>
            <button class="text-teal-600 dark:text-teal-400 hover:underline" @click="resetCaption">
              重新生成文案
            </button>
          </div>
        </section>

        <!-- 下载 -->
        <section class="p-4 border border-gray-200 rounded-2xl bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 class="text-sm text-gray-800 font-semibold dark:text-gray-100">
            下载图文
          </h2>
          <p class="text-xs text-gray-400 mt-0.5">
            3 张 PNG + 文案 TXT，打包为 ZIP。
          </p>

          <button
            class="text-sm text-white font-medium mt-3 px-4 py-2.5 rounded-lg bg-teal-600 flex gap-2 w-full transition-colors items-center justify-center hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!allReady || isRendering || isZipping"
            @click="downloadAll"
          >
            <div v-if="isZipping" class="i-carbon-circle-dash h-4 w-4 animate-spin" aria-hidden="true" />
            <div v-else class="i-carbon-download h-4 w-4" aria-hidden="true" />
            {{ isZipping ? '正在打包...' : '下载全部图文（ZIP）' }}
          </button>

          <div class="mt-2 gap-2 grid grid-cols-3">
            <button
              v-for="slide in slides"
              :key="slide.key"
              class="text-xs text-gray-600 px-2 py-2 border border-gray-300 rounded-lg bg-white transition-colors dark:text-gray-300 dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-gray-700"
              :disabled="!slideUrls[slide.key] || isRendering"
              :aria-label="`下载${slide.label}海报`"
              @click="downloadSlide(slide.key)"
            >
              {{ slide.label }}
            </button>
          </div>
        </section>

        <!-- 提示 -->
        <section class="p-4 border border-teal-200 rounded-2xl bg-teal-50/60 dark:border-teal-800 dark:bg-teal-900/20">
          <h2 class="text-sm text-teal-800 font-semibold dark:text-teal-300">
            发布小贴士
          </h2>
          <ul class="text-xs text-gray-600 mt-2 space-y-1.5 dark:text-gray-400">
            <li>首图用「封面」，3:4 在抖音图文里更吸睛。</li>
            <li>第二张放「三视图」，展示图像处理过程。</li>
            <li>最后一张放「数据」，配合文案里的观测时间。</li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

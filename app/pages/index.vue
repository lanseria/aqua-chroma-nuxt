<script setup lang="ts">
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { storeToRefs } from 'pinia'
import DebugResultViewer from '~/components/DebugResultViewer.vue'
import { useAnalysisStore } from '~/stores/analysis'

const dayjs = useDayjs()
// URL
const runtimeConfig = useRuntimeConfig()
const apiUrl = runtimeConfig.public.apiUrl

const analysisStore = useAnalysisStore()
const { results } = storeToRefs(analysisStore)

const INITIAL_LOAD_COUNT = 12
const LOAD_MORE_COUNT = 8

const displayedCount = ref(INITIAL_LOAD_COUNT)
const isLoadingMore = ref(false)
const allDataLoaded = computed(() => displayedCount.value >= results.value.length)

const displayedResults = computed(() => results.value.filter(m => m.status === 'completed').slice(0, displayedCount.value))

// 加载更多数据的函数
function loadMore() {
  if (isLoadingMore.value || allDataLoaded.value)
    return

  isLoadingMore.value = true
  // 模拟网络延迟
  setTimeout(() => {
    displayedCount.value += LOAD_MORE_COUNT
    isLoadingMore.value = false
  }, 500)
}

// 滚动事件处理
function handleScroll() {
  const buffer = 200 // 距离底部 200px 时开始加载
  const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - buffer
  if (isAtBottom)
    loadMore()
}

// 调试工具的状态
const debugTimestampInput = ref('')
const isDebugging = ref(false)
const debugToolRef = ref<HTMLElement | null>(null) // 用于获取调试工具DOM元素

// --- 批量下载相关状态与逻辑 ---
const downloadDateRange = ref<[number, number] | []>([]) // 存储毫秒级时间戳
const isDownloading = ref(false)

// 辅助函数：将秒数格式化为 SRT 时间格式 (HH:mm:ss,SSS)
function formatSrtTime(seconds: number) {
  const pad = (num: number, size: number) => num.toString().padStart(size, '0')
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},000`
}

async function handleBatchDownload() {
  if (!downloadDateRange.value || downloadDateRange.value.length !== 2) {
    Message.warning('请先选择下载的时间范围')
    return
  }

  isDownloading.value = true
  const zip = new JSZip()

  // 创建文件夹
  const folderInput = zip.folder('01_input_processed')
  const folderHsv = zip.folder('04_hsv_classification')

  // 转换时间戳范围 (Arco 返回的是毫秒，后端数据是秒)
  const startTs = Math.floor(downloadDateRange.value[0] / 1000)
  const endTs = Math.floor(downloadDateRange.value[1] / 1000) + 86399 // 包含当天的最后一秒

  // 筛选符合条件的数据，并按时间戳正序排列（这对于生成的字幕时间轴很重要）
  const targetItems = results.value
    .filter(item => item.timestamp >= startTs && item.timestamp <= endTs && item.status === 'completed')
    .sort((a, b) => a.timestamp - b.timestamp)

  if (targetItems.length === 0) {
    Message.info('该时间段内没有可下载的数据')
    isDownloading.value = false
    return
  }

  Message.loading(`正在处理 ${targetItems.length} 组数据...`)

  try {
    let srtContent = ''

    // 并行下载所有图片
    const promises = targetItems.map(async (item) => {
      const inputUrl = `${apiUrl}/${item.output_directory}/01_input_processed.png`
      const hsvUrl = `${apiUrl}/${item.output_directory}/04_hsv_classification.png`

      // 构建 SRT 字幕段落 (1秒对应一个时间戳)
      // const startTime = formatSrtTime(index)
      // const endTime = formatSrtTime(index + 1)
      // const timeDisplay = dayjs.unix(item.timestamp).format('YYYY-MM-DD HH:mm')

      // SRT 格式: 序号 \n 开始 --> 结束 \n 内容 \n\n
      // 注意：由于这是在 map 中并发执行，直接拼接字符串可能会有顺序问题。
      // 但因为我们只是构造字符串，且 JS 是单线程执行回调，我们可以预先生成数组再 join，或者在这里直接利用 index。
      // 为确保顺序绝对正确，我们在 map 外部生成 SRT，这里只处理下载。

      try {
        // Fetch 图片数据
        const [inputBlob, hsvBlob] = await Promise.all([
          fetch(inputUrl).then(res => res.blob()),
          fetch(hsvUrl).then(res => res.blob()),
        ])

        // 添加到 ZIP，重命名为 [timestamp].png
        folderInput?.file(`${item.timestamp}.png`, inputBlob)
        folderHsv?.file(`${item.timestamp}.png`, hsvBlob)
      }
      catch (err) {
        console.warn(`下载图片失败: ${item.timestamp}`, err)
      }
    })

    // 执行下载
    await Promise.all(promises)

    // 生成 SRT 字幕内容 (在下载完成后基于排序好的列表生成，确保 100% 顺序正确)
    targetItems.forEach((item, index) => {
      const seq = index + 1
      const startTime = formatSrtTime(index)
      const endTime = formatSrtTime(index + 1)
      const timeDisplay = dayjs.unix(item.timestamp).format('YYYY-MM-DD HH:mm')

      srtContent += `${seq}\n${startTime} --> ${endTime}\n${timeDisplay}\n\n`
    })

    // 将 SRT 文件加入 ZIP 根目录
    zip.file('timeline.srt', srtContent)

    // 生成并触发下载
    const content = await zip.generateAsync({ type: 'blob' })
    const dateStr = new Date().toISOString().split('T')[0]
    saveAs(content, `aqua-chroma-dataset-${dateStr}.zip`)
    Message.success('打包下载成功')
  }
  catch (error) {
    console.error('批量下载失败:', error)
    Message.error('打包下载过程中发生错误')
  }
  finally {
    isDownloading.value = false
  }
}
// ---------------------------------------

function handleTimestampSelected(timestamp: number) {
  // 将数字时间戳转换为字符串并赋值给输入框的 v-model
  debugTimestampInput.value = String(timestamp)

  // 友好交互：滚动到页面顶部，让用户看到输入框的变化
  // 使用 behavior: 'smooth' 实现平滑滚动
  window.scrollTo({ top: 0, behavior: 'smooth' })

  // 也可以让输入框聚焦，但平滑滚动体验更好
  // debugToolRef.value?.querySelector('input')?.focus()
}

// 优化 handleTriggerDebug 函数，让它调用新的弹窗函数
async function handleTriggerDebug() {
  if (!debugTimestampInput.value) {
    Message.warning('请输入有效的时间戳')
    return
  }
  isDebugging.value = true
  try {
    const timestamp = +debugTimestampInput.value
    if (Number.isNaN(timestamp)) {
      Message.error('时间格式无效，请输入 Unix 时间戳')
      return
    }
    const resultData = await analysisStore.triggerDebugAnalysis(timestamp)
    if (resultData) {
      Modal.info({
        title: '调试分析结果',
        content: () => h(DebugResultViewer, { result: resultData, apiUrl }),
        width: '900px',
        modalClass: 'debug-result-modal',
        titleAlign: 'start',
        maskClosable: true,
      })
    }
  }
  finally {
    isDebugging.value = false
  }
}

// 页面加载时获取初始数据
onMounted(async () => {
  // 如果 store 中没有数据，则从 API 获取
  if (results.value.length === 0)
    await analysisStore.fetchResults()

  window.addEventListener('scroll', handleScroll)
})

// 组件卸载时移除事件监听
onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <div class="p-4 sm:p-6">
    <div class="mb-6 space-y-4">
      <TrendChart :results="results" @timestamp-selected="handleTimestampSelected" />

      <div ref="debugToolRef" class="p-3 border border-gray-200 rounded-lg bg-white flex flex-wrap gap-4 shadow-sm items-center dark:border-gray-700 dark:bg-gray-800">
        <!-- 原有的单点调试 -->
        <div class="flex gap-2 items-center">
          <span class="font-medium flex-none">单点调试:</span>
          <AInput
            v-model="debugTimestampInput"
            placeholder="输入时间戳"
            class="!w-40"
          />
          <AButton type="primary" :loading="isDebugging" @click="handleTriggerDebug">
            <template #icon>
              <div class="i-carbon-debug" />
            </template>
            分析
          </AButton>
        </div>

        <div class="bg-gray-300 h-6 w-px hidden dark:bg-gray-600 sm:block" />

        <!-- 新增的批量下载 -->
        <div class="flex gap-2 items-center">
          <span class="font-medium flex-none">数据集下载:</span>
          <ARangePicker
            v-model="downloadDateRange"
            value-format="timestamp"
            :disabled-date="(current: any) => dayjs(current).isAfter(dayjs())"
            style="width: 260px;"
          />
          <AButton type="outline" status="success" :loading="isDownloading" @click="handleBatchDownload">
            <template #icon>
              <div class="i-carbon-download" />
            </template>
            打包下载
          </AButton>
        </div>
      </div>
    </div>
    <!-- 卡片网格布局 -->
    <div class="gap-4 grid grid-cols-1 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
      <AnalysisCard v-for="item in displayedResults" :key="item.timestamp" :item="item" @timestamp-selected="handleTimestampSelected" />
    </div>

    <!-- 加载指示器 -->
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
  </div>
</template>

<style>
/* 添加一个全局样式来处理弹窗内容溢出时出现滚动条 */
.debug-result-modal .arco-modal-body {
  max-height: 70vh;
  overflow-y: auto;
}
</style>

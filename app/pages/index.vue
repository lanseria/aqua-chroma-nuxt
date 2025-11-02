<script setup lang="ts">
import { storeToRefs } from 'pinia'
import DebugResultViewer from '~/components/DebugResultViewer.vue'
import { useAnalysisStore } from '~/stores/analysis'

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

// --- 一个可复用的函数，用于显示调试弹窗 ---
function showDebugDetails(resultItem: AnalysisResult) {
  Modal.info({
    title: '分析结果详情',
    content: () => h(DebugResultViewer, { result: resultItem, apiUrl }),
    width: '900px',
    modalClass: 'debug-result-modal',
    titleAlign: 'start',
    maskClosable: true,
  })
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
    // 注意：这里的 result 是后端返回的 data 部分
    const resultData = await analysisStore.triggerDebugAnalysis(timestamp)
    if (resultData) {
      // 调用我们新创建的通用弹窗函数
      showDebugDetails(resultData)
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
      <TrendChart :results="results" @request-debug="showDebugDetails" />

      <div class="p-3 border border-gray-200 rounded-lg bg-white flex gap-2 shadow-sm items-center dark:border-gray-700 dark:bg-gray-800">
        <span class="font-medium flex-none">调试工具:</span>
        <AInput
          v-model="debugTimestampInput"
          placeholder="输入时间戳1761978000"
        />
        <AButton type="primary" :loading="isDebugging" @click="handleTriggerDebug">
          <template #icon>
            <div class="i-carbon-debug" />
          </template>
          触发分析
        </AButton>
      </div>
    </div>
    <!-- 卡片网格布局 -->
    <div class="gap-4 grid grid-cols-1 lg:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
      <AnalysisCard v-for="item in displayedResults" :key="item.timestamp" :item="item" />
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

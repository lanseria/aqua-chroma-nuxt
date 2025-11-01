<script lang="ts" setup>
import type { AnalysisResult } from '~/stores/analysis'
import { LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { THEME_KEY } from 'vue-echarts'

const props = defineProps<{
  results: AnalysisResult[]
}>()

// --- 新增：定义要发出的自定义事件 ---
const emits = defineEmits<{
  (e: 'request-debug', item: AnalysisResult): void
}>()

const dayjs = useDayjs()
const colorMode = useColorMode()

provide(THEME_KEY, computed(() => colorMode.value === 'dark' ? 'dark' : 'default'))

use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  ToolboxComponent,
  DataZoomComponent,
])

// --- 新增：将 chartData 提取为独立的 computed 属性，方便在点击事件中复用 ---
const chartData = computed(() =>
  props.results
    .filter(r => r.status === 'completed' && r.sea_blueness !== null)
    .sort((a, b) => a.timestamp - b.timestamp),
)

const chartOption = computed(() => {
  return {
    title: {
      text: '海蓝程度趋势分析 (点击数据点查看详情)',
      left: 'center',
      textStyle: {
        fontSize: 16, // 调整字体大小以适应更长的标题
      },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const data = params[0]
        return `${data.name}<br/>海蓝程度: <strong>${data.value.toFixed(2)}%</strong>`
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      // --- 修改点：使用提取的 chartData ---
      data: chartData.value.map(r => dayjs.unix(r.timestamp).format('MM-DD HH:mm')),
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        formatter: '{value} %',
      },
    },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { start: 0, end: 100 },
    ],
    series: [
      {
        name: '海蓝程度',
        type: 'line',
        smooth: true,
        // --- 修改点：使用提取的 chartData ---
        data: chartData.value.map(r => (r.sea_blueness ?? 0) * 100),
        itemStyle: { color: '#3b82f6' },
        // --- 新增：添加光标样式，提示用户可以点击 ---
        cursor: 'pointer',
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.5)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.1)' },
            ],
          },
        },
      },
    ],
  }
})

// --- 新增：图表点击事件处理函数 ---
function handleChartClick(params: any) {
  // params.dataIndex 是 ECharts 提供的点击项的索引
  if (params.dataIndex !== undefined) {
    // 根据索引从我们排序好的 chartData 中找到对应的原始数据项
    const clickedItem = chartData.value[params.dataIndex]
    if (clickedItem) {
      // 发出自定义事件，并附带完整的数据项
      emits('request-debug', clickedItem)
    }
  }
}
</script>

<template>
  <div class="p-4 border border-gray-200 rounded-lg bg-white h-400px w-full shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <VChartFull :option="chartOption" autoresize @click="handleChartClick" />
  </div>
</template>

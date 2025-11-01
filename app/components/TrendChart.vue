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
import VChart from 'vue-echarts'

const props = defineProps<{
  results: AnalysisResult[]
}>()

const dayjs = useDayjs()

use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  ToolboxComponent,
  DataZoomComponent,
])

const chartOption = computed(() => {
  // --- 修改点：过滤 null 值和 status，并按时间升序 ---
  const chartData = props.results
    .filter(r => r.status === 'completed' && r.sea_blueness !== null)
    .sort((a, b) => a.timestamp - b.timestamp)

  return {
    title: {
      text: '海蓝程度趋势分析',
      left: 'center',
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
      // --- 修改点：使用 dayjs.unix() ---
      data: chartData.map(r => dayjs.unix(r.timestamp).format('MM-DD HH:mm')),
    },
    yAxis: {
      type: 'value',
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
        // --- 修改点：使用 sea_blueness 并转换为百分比 ---
        data: chartData.map(r => (r.sea_blueness ?? 0) * 100),
        itemStyle: { color: '#3b82f6' },
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
</script>

<template>
  <div class="p-4 border border-gray-200 rounded-lg bg-white h-400px w-full shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <VChart :option="chartOption" autoresize />
  </div>
</template>

<script lang="ts" setup>
import type { EChartsOption } from 'echarts'
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'

const props = defineProps<{
  frames: AnalysisResult[]
  currentIndex: number
}>()

const emits = defineEmits<{
  (e: 'seek', index: number): void
  (e: 'preview', index: number): void
  (e: 'preview-end'): void
}>()

// 悬停预览：轴指针移动时取 x 轴的 value（category 轴上即帧索引）上报给父级
function handleAxisPointerUpdate(params: any) {
  const info = params?.axesInfo?.find((a: any) => a.axisDim === 'x') ?? params?.axesInfo?.[0]
  if (!info)
    return
  const idx = Number(info.value)
  if (Number.isInteger(idx) && idx >= 0 && idx < props.frames.length)
    emits('preview', idx)
}

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

provide(THEME_KEY, computed(() => isDark.value ? 'dark' : 'default'))

// 海蓝程度取值：优先综合海蓝指数 blueness_index（v1/v2 同义，均含云量折减）；
// 极老记录回填缺失时退回 sea_blueness（v1 口径本身即含云折减，语义一致）
function bluenessPercent(r: AnalysisResult): number {
  const v = r.blueness_index ?? r.sea_blueness
  return (v ?? 0) * 100
}

// 关闭动画，保证播放头逐帧移动时不产生滞后拖影
const chartOption = computed<EChartsOption>(() => ({
  animation: false,
  tooltip: {
    trigger: 'axis',
    backgroundColor: isDark.value ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    borderColor: isDark.value ? '#4b5563' : '#e5e7eb',
    textStyle: {
      color: isDark.value ? '#e5e7eb' : '#374151',
    },
    valueFormatter: value => `${Number(value).toFixed(1)}%`,
  },
  legend: {
    data: ['海蓝程度', '云层覆盖率'],
    top: 0,
    right: 0,
    icon: 'roundRect',
    itemWidth: 14,
    itemHeight: 4,
    textStyle: {
      color: isDark.value ? '#9ca3af' : '#4b5563',
      fontSize: 11,
    },
  },
  grid: {
    left: 8,
    right: 8,
    top: 28,
    bottom: 8,
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: props.frames.map(r => format(fromUnixTime(r.timestamp), 'MM-dd HH:mm')),
    axisLabel: {
      color: isDark.value ? '#9ca3af' : '#6b7280',
      hideOverlap: true,
      fontSize: 10,
    },
    axisLine: {
      lineStyle: {
        color: isDark.value ? '#4b5563' : '#d1d5db',
      },
    },
  },
  yAxis: {
    type: 'value',
    min: 0,
    max: 100,
    axisLabel: {
      formatter: '{value}%',
      color: isDark.value ? '#9ca3af' : '#6b7280',
      fontSize: 10,
    },
    splitLine: {
      lineStyle: {
        color: isDark.value ? '#374151' : '#e5e7eb',
      },
    },
  },
  dataZoom: [
    { type: 'inside' },
  ],
  series: [
    {
      name: '海蓝程度',
      type: 'line',
      smooth: true,
      sampling: 'lttb',
      showSymbol: false,
      data: props.frames.map(r => bluenessPercent(r)),
      itemStyle: { color: '#3b82f6' },
      lineStyle: { width: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.02)' },
          ],
        },
      },
      // 播放头：随当前帧移动的垂直标线
      markLine: {
        silent: true,
        symbol: 'none',
        animation: false,
        label: { show: false },
        lineStyle: {
          color: '#14b8a6',
          width: 2,
          type: 'solid',
        },
        data: props.frames.length > 0
          ? [{ xAxis: props.currentIndex }]
          : [],
      },
    },
    {
      name: '云层覆盖率',
      type: 'line',
      smooth: true,
      sampling: 'lttb',
      showSymbol: false,
      data: props.frames.map(r => (r.cloud_coverage ?? 0) * 100),
      itemStyle: { color: '#9ca3af' },
      lineStyle: {
        width: 1.5,
        type: 'dashed',
        color: '#9ca3af',
        opacity: 0.7,
      },
      z: 1,
    },
  ],
}))

function handleChartClick(params: any) {
  if (params.dataIndex !== undefined)
    emits('seek', params.dataIndex)
}
</script>

<template>
  <div
    class="p-3 border border-gray-200 rounded-lg bg-white w-full shadow-sm dark:border-gray-700 dark:bg-gray-800"
    @mouseleave="emits('preview-end')"
  >
    <VChartFull :option="chartOption" autoresize @update-axis-pointer="handleAxisPointerUpdate" @click="handleChartClick" />
  </div>
</template>

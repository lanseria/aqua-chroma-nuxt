<script lang="ts" setup>
import type { EChartsOption } from 'echarts'
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'
import { BLUENESS_LEVELS, bluenessPercent, chartResults, getBluenessLevel, VISIBILITY_MAX_KM } from '~/utils/analysis-metrics'

const props = defineProps<{
  results: AnalysisResult[]
  /** 聚焦日期（yyyy-MM-dd，浏览器本地时区）：仅绘制该自然日 00:00–24:00 的数据；null / 未传 = 全量 */
  focusDate?: string | null
}>()

const emits = defineEmits<{
  (e: 'timestamp-selected', timestamp: number): void
  (e: 'preview', timestamp: number): void
}>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

provide(THEME_KEY, computed(() => isDark.value ? 'dark' : 'default'))

const chartRef = ref<any>(null)

// 状态口径：completed 与 cloudy（云量偏高）都有指标值，均参与绘制；
// night / error / download_failed 无指标，按“有数值”过滤即可排除。
const visibleData = computed(() => chartResults(props.results, props.focusDate))

// 切换时间范围 / 聚焦日期后把缩放归位，避免残留上一个数据集的窗口
watch([
  () => props.focusDate,
  () => props.results.length,
], () => {
  nextTick(() => chartRef.value?.chart?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 }))
})

// 海蓝分级虚线：颜色与图例、分享海报保持一致，具体描述在图表上方图例中展示

// --- 计算日期分隔线 ---
const dateMarkLines = computed(() => {
  const lines: any[] = []
  let lastDate = ''

  visibleData.value.forEach((item, index) => {
    const currentDate = format(fromUnixTime(item.timestamp), 'yyyy-MM-dd')

    // 只要不是第一个点，且日期变化了，就加线
    if (index > 0 && currentDate !== lastDate) {
      lines.push({
        xAxis: index,
        label: {
          formatter: format(fromUnixTime(item.timestamp), 'MM-dd'),
          position: 'end',
          color: isDark.value ? '#64748b' : '#94a3b8',
          fontSize: 10,
          padding: [0, 0, 4, 0],
        },
        lineStyle: {
          color: isDark.value ? '#1f2937' : '#e2e8f0',
          type: 'solid',
          width: 1,
        },
      })
    }
    lastDate = currentDate
  })
  return lines
})

function seriesValue(value: number | null | undefined, fallback = '--') {
  return value == null
    ? fallback
    : value.toFixed(1)
}

function tooltipFormatter(params: any) {
  const list = Array.isArray(params)
    ? params
    : [params]
  const index = list[0]?.dataIndex
  const record = visibleData.value[index]
  const title = record
    ? format(fromUnixTime(record.timestamp), 'yyyy-MM-dd HH:mm')
    : list[0]?.axisValueLabel

  const rows = list.map((item: any) => {
    const isVisibility = item.seriesName === '能见度'
    const hasValue = item.value !== null && item.value !== undefined
    const value = hasValue
      ? `${seriesValue(Number(item.value))}${isVisibility ? ' km' : ' %'}`
      : '--'
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;line-height:1.9;">
        <span style="display:flex;align-items:center;">${item.marker}<span style="margin-left:4px;">${item.seriesName}</span></span>
        <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600;">${value}</span>
      </div>
    `
  }).join('')

  const level = record
    ? getBluenessLevel(bluenessPercent(record))
    : null
  const levelNote = level
    ? `<div style="margin-top:4px;font-size:10px;color:${isDark.value ? '#94a3b8' : '#64748b'};">海蓝分级：<span style="color:${level.color};font-weight:600;">${level.name}</span></div>`
    : ''

  const cloudyNote = record?.status === 'cloudy'
    ? '<div style="margin-top:6px;font-size:10px;color:#d97706;">云层偏厚，水色指标参考性下降</div>'
    : ''

  return `
    <div style="min-width:180px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
        <span style="font-size:11px;font-weight:600;color:${isDark.value ? '#e2e8f0' : '#334155'};">${title}</span>
        ${record
          ? `<span style="font-size:10px;color:${isDark.value ? '#94a3b8' : '#64748b'};">${record.visibility_level ?? ''}</span>`
          : ''}
      </div>
      ${rows}
      ${levelNote}
      ${cloudyNote}
      <div style="margin-top:6px;padding-top:6px;border-top:1px solid ${isDark.value ? '#334155' : '#e2e8f0'};font-size:10px;color:${isDark.value ? '#64748b' : '#94a3b8'};">点击数据点查看完整分析详情</div>
    </div>
  `
}

const chartOption = computed<EChartsOption>(() => ({
  animationDuration: 600,
  animationEasing: 'cubicOut',
  tooltip: {
    trigger: 'axis',
    confine: true,
    backgroundColor: isDark.value ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
    borderColor: isDark.value ? '#334155' : '#e2e8f0',
    borderWidth: 1,
    padding: [10, 12],
    textStyle: {
      color: isDark.value ? '#e2e8f0' : '#334155',
    },
    extraCssText: 'border-radius:10px;box-shadow:0 12px 32px rgba(15,23,42,.16);',
    axisPointer: {
      type: 'line',
      snap: true,
      lineStyle: {
        color: isDark.value ? 'rgba(45, 212, 191, 0.7)' : 'rgba(13, 148, 136, 0.45)',
        width: 1,
        type: 'dashed',
      },
      label: { show: false },
    },
    formatter: tooltipFormatter,
  },
  legend: {
    data: ['海蓝程度', '云层覆盖率', '能见度'],
    top: 2,
    right: 4,
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 3,
    itemGap: 14,
    textStyle: {
      color: isDark.value ? '#94a3b8' : '#64748b',
      fontSize: 11,
    },
    inactiveColor: isDark.value ? '#475569' : '#cbd5e1',
  },
  grid: {
    left: 4,
    right: 8,
    top: 38,
    bottom: 58,
    containLabel: true,
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: visibleData.value.map(r => format(fromUnixTime(r.timestamp), 'MM-dd HH:mm')),
    axisLine: {
      lineStyle: {
        color: isDark.value ? '#334155' : '#e2e8f0',
      },
    },
    axisTick: { show: false },
    axisLabel: {
      color: isDark.value ? '#64748b' : '#94a3b8',
      fontSize: 10,
      hideOverlap: true,
      margin: 12,
    },
    axisPointer: {
      show: true,
      type: 'line',
      snap: true,
      lineStyle: {
        color: isDark.value ? 'rgba(45, 212, 191, 0.55)' : 'rgba(13, 148, 136, 0.35)',
        width: 1,
        type: 'dashed',
      },
      label: { show: false },
    },
  },
  yAxis: [
    {
      type: 'value',
      min: 0,
      max: 100,
      interval: 20,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        formatter: '{value}%',
        color: isDark.value ? '#64748b' : '#94a3b8',
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: isDark.value ? 'rgba(51, 65, 85, 0.55)' : '#f1f5f9',
          type: 'dashed',
        },
      },
    },
    {
      // 能见度（公里）独立右轴，上限 35km 与后端 config.VISIBILITY_MAX_KM 一致
      type: 'value',
      min: 0,
      max: VISIBILITY_MAX_KM,
      interval: 7,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        formatter: '{value} km',
        color: isDark.value ? '#64748b' : '#94a3b8',
        fontSize: 10,
      },
      splitLine: { show: false },
    },
  ],
  dataZoom: [
    {
      type: 'inside',
      start: 0,
      end: 100,
      moveOnMouseMove: true,
      moveOnMouseWheel: false,
      zoomOnMouseWheel: true,
    },
    {
      type: 'slider',
      start: 0,
      end: 100,
      height: 16,
      bottom: 6,
      borderColor: 'transparent',
      backgroundColor: isDark.value ? 'rgba(148, 163, 184, 0.08)' : 'rgba(148, 163, 184, 0.10)',
      fillerColor: isDark.value ? 'rgba(20, 184, 166, 0.18)' : 'rgba(20, 184, 166, 0.12)',
      handleStyle: {
        color: '#14b8a6',
        borderColor: '#14b8a6',
      },
      moveHandleStyle: {
        color: '#14b8a6',
        opacity: 0.35,
      },
      dataBackground: {
        lineStyle: {
          color: isDark.value ? '#334155' : '#cbd5e1',
        },
        areaStyle: {
          color: isDark.value ? '#1e293b' : '#f1f5f9',
        },
      },
      selectedDataBackground: {
        lineStyle: { color: '#14b8a6' },
        areaStyle: { color: 'rgba(20, 184, 166, 0.12)' },
      },
      textStyle: {
        color: isDark.value ? '#64748b' : '#94a3b8',
        fontSize: 9,
      },
      brushSelect: false,
    },
  ],
  series: [
    {
      name: '海蓝程度',
      type: 'line',
      smooth: 0.25,
      sampling: 'lttb',
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 7,
      data: visibleData.value.map(bluenessPercent),
      lineStyle: {
        width: 2.5,
        color: '#38bdf8',
        shadowColor: 'rgba(56, 189, 248, 0.3)',
        shadowBlur: 10,
      },
      itemStyle: {
        color: '#38bdf8',
        borderColor: isDark.value ? '#0f172a' : '#ffffff',
        borderWidth: 2,
      },
      emphasis: {
        focus: 'series',
        scale: 1.4,
      },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(56, 189, 248, 0.34)' },
            { offset: 0.6, color: 'rgba(56, 189, 248, 0.10)' },
            { offset: 1, color: 'rgba(56, 189, 248, 0.01)' },
          ],
        },
      },
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          ...BLUENESS_LEVELS.filter(level => level.threshold > 0).map(level => ({
            yAxis: level.threshold,
            label: { show: false },
            lineStyle: {
              type: 'dashed',
              color: level.color,
              opacity: 0.18,
              width: 1,
            },
          })),
          ...dateMarkLines.value,
        ],
      },
      z: 3,
    },
    {
      name: '云层覆盖率',
      type: 'line',
      smooth: 0.25,
      sampling: 'lttb',
      showSymbol: false,
      connectNulls: false,
      data: visibleData.value.map(r => r.cloud_coverage == null
        ? null
        : r.cloud_coverage * 100),
      itemStyle: { color: '#94a3b8' },
      lineStyle: {
        width: 1.5,
        type: 'dashed',
        color: '#94a3b8',
        opacity: 0.85,
      },
      z: 1,
    },
    {
      name: '能见度',
      type: 'line',
      smooth: 0.25,
      sampling: 'lttb',
      yAxisIndex: 1,
      showSymbol: false,
      // 旧记录 visibility_km 为 null：断开连线，只绘制有值的区段
      connectNulls: false,
      data: visibleData.value.map(r => r.visibility_km),
      itemStyle: { color: '#14b8a6' },
      lineStyle: {
        width: 2,
        color: '#14b8a6',
        shadowColor: 'rgba(20, 184, 166, 0.3)',
        shadowBlur: 8,
      },
      z: 2,
    },
  ],
}))

let lastPreviewTimestamp: number | null = null

// 悬停预览：轴指针移动时把当前 x 轴（category 索引）对应的记录上报给父级
function handleAxisPointerUpdate(params: any) {
  const info = params?.axesInfo?.find((axis: any) => axis.axisDim === 'x') ?? params?.axesInfo?.[0]
  if (!info)
    return

  const item = visibleData.value[Number(info.value)]
  if (item && item.timestamp !== lastPreviewTimestamp) {
    lastPreviewTimestamp = item.timestamp
    emits('preview', item.timestamp)
  }
}

function handleChartClick(params: any) {
  if (params.dataIndex === undefined)
    return

  const clickedItem = visibleData.value[params.dataIndex]
  if (clickedItem)
    emits('timestamp-selected', clickedItem.timestamp)
}
</script>

<template>
  <div class="h-340px w-full relative sm:h-430px">
    <VChartFull
      v-if="visibleData.length > 0"
      ref="chartRef"
      class="h-full w-full"
      :option="chartOption"
      autoresize
      @update-axis-pointer="handleAxisPointerUpdate"
      @click="handleChartClick"
    />

    <div v-else class="text-gray-400 border border-gray-200 rounded-xl border-dashed flex flex-col gap-1 h-full items-center justify-center dark:border-gray-700">
      <div class="i-carbon-chart-line h-8 w-8" aria-hidden="true" />
      <p class="text-sm">
        当前范围内暂无可绘制的指标数据
      </p>
      <p class="text-xs">
        夜间记录与指标缺失的记录不会出现在趋势图中
      </p>
    </div>

    <p class="sr-only">
      趋势图包含 {{ visibleData.length }} 个有效数据点，展示海蓝程度、云层覆盖率与能见度。
    </p>
  </div>
</template>

<script lang="ts" setup>
import type { EChartsOption } from 'echarts'
import type { AnalysisResult } from '~/stores/analysis'

const props = defineProps<{
  results: AnalysisResult[]
}>()

// --- 定义要发出的自定义事件 ---
const emits = defineEmits<{
  (e: 'timestamp-selected', timestamp: number): void
}>()

const dayjs = useDayjs()

// 定义 Y 轴标记线及其美化后的描述文字
const markLineLevels = [
  { yAxis: 80, name: '湛蓝如镜', color: '#10b981' }, // 极佳
  { yAxis: 60, name: '清澈蔚蓝', color: '#3b82f6' }, // 不错
  { yAxis: 40, name: '碧波荡漾', color: '#f59e0b' }, // 一般
  { yAxis: 20, name: '略显浑浊', color: '#ef4444' }, // 较差
]

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

provide(THEME_KEY, computed(() => isDark.value ? 'dark' : 'default'))

// --- 将 chartData 提取为独立的 computed 属性，方便在点击事件中复用 ---
const chartData = computed(() =>
  props.results
    .filter(r => r.status === 'completed' && r.sea_blueness !== null)
    .sort((a, b) => a.timestamp - b.timestamp),
)

// --- 计算日期分隔线 ---
const dateMarkLines = computed(() => {
  const lines: any[] = []
  let lastDate = ''

  chartData.value.forEach((item, index) => {
    const currentDate = dayjs.unix(item.timestamp).format('YYYY-MM-DD')

    // 只要不是第一个点，且日期变化了，就加线
    if (index > 0 && currentDate !== lastDate) {
      lines.push({
        xAxis: index, // 在 Category 轴上，可以用索引定位
        label: {
          formatter: dayjs.unix(item.timestamp).format('MM-DD'),
          position: 'end', // 显示在顶部
          color: isDark.value ? '#9ca3af' : '#9ca3af', // 统一使用灰色
          fontSize: 11,
          padding: [0, 0, 2, 0], // 微调位置
        },
        lineStyle: {
          // 亮色模式下浅灰，暗色模式下深灰
          color: isDark.value ? '#374151' : '#e5e7eb',
          type: 'solid',
          width: 1,
        },
      })
    }
    lastDate = currentDate
  })
  return lines
})

const chartOption = computed<EChartsOption>(() => {
  return {
    title: {
      text: '海蓝程度趋势分析 (点击数据点查看详情)',
      left: 'center',
      textStyle: {
        fontSize: 16, // 调整字体大小以适应更长的标题
        color: isDark.value ? '#e5e7eb' : '#374151',
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark.value ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      borderColor: isDark.value ? '#4b5563' : '#e5e7eb',
      textStyle: {
        color: isDark.value ? '#e5e7eb' : '#374151',
      },
      formatter: (params: any) => {
        let result = `<div class="mb-1 font-medium text-xs">${params[0].axisValueLabel}</div>`
        params.forEach((item: any) => {
          const val = typeof item.value === 'number' ? item.value.toFixed(1) : '--'
          result += `
            <div class="flex items-center justify-between gap-3 text-xs">
              <span class="flex items-center gap-1">${item.marker} ${item.seriesName}</span>
              <span class="font-bold font-mono">${val}%</span>
            </div>
          `
        })
        return result
      },
    },
    legend: {
      data: ['海蓝程度', '云层覆盖率'],
      bottom: 0,
      textStyle: {
        color: isDark.value ? '#9ca3af' : '#4b5563',
      },
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '12%', // 稍微增加底部空间给 Legend
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      // --- 修改点：使用提取的 chartData ---
      data: chartData.value.map(r => dayjs.unix(r.timestamp).format('MM-DD HH:mm')),
      axisLabel: {
        color: isDark.value ? '#9ca3af' : '#6b7280',
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        formatter: '{value} %',
        color: isDark.value ? '#9ca3af' : '#6b7280',
      },
      splitLine: {
        lineStyle: {
          color: isDark.value ? '#374151' : '#e5e7eb',
        },
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
        sampling: 'lttb', // --- 新增：开启降采样优化 ---
        data: chartData.value.map(r => (r.sea_blueness ?? 0) * 100),
        itemStyle: { color: '#3b82f6' },
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
        // --- 新增：添加标记线 (合并水平阈值线和垂直日期分割线) ---
        markLine: {
          silent: true, // 标记线不响应鼠标事件
          symbol: 'none', // 两端不显示任何符号
          data: [
            // 1. 水平阈值线
            ...markLineLevels.map(item => ({
              yAxis: item.yAxis,
              label: {
                position: 'end', // 标签显示在行的末端（右侧）
                formatter: item.name, // 使用我们定义的美化名称
                color: item.color, // 标签颜色与线条颜色一致
                fontSize: 10,
                distance: 10, // 标签与图表边缘的距离
              },
              lineStyle: {
                type: 'dashed', // 设置为虚线
                color: item.color, // 线条颜色
                opacity: 0.6,
              },
            })),
            // 2. 垂直日期分割线
            ...dateMarkLines.value,
          ],
        },
      },
      {
        name: '云层覆盖率',
        type: 'line',
        smooth: true,
        sampling: 'lttb', // --- 新增：开启降采样优化 ---
        showSymbol: false, // 不显示数据点，减少视觉干扰
        data: chartData.value.map(r => (r.cloud_coverage ?? 0) * 100),
        itemStyle: {
          width: 1.5,
          type: 'dashed', // 使用虚线表示辅助数据
          opacity: 0.6, // 降低不透明度
          color: '#9ca3af',
        },
        z: 1, // 渲染层级较低
      },
    ],
  }
})

function handleChartClick(params: any) {
  if (params.dataIndex !== undefined) {
    const clickedItem = chartData.value[params.dataIndex]
    if (clickedItem) {
      // 发出只包含时间戳的事件
      emits('timestamp-selected', clickedItem.timestamp)
    }
  }
}
</script>

<template>
  <div class="p-4 border border-gray-200 rounded-lg bg-white h-400px w-full shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <VChartFull :option="chartOption" autoresize @click="handleChartClick" />
  </div>
</template>

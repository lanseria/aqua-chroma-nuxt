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

provide(THEME_KEY, computed(() => colorMode.value === 'dark' ? 'dark' : 'default'))

// --- 将 chartData 提取为独立的 computed 属性，方便在点击事件中复用 ---
const chartData = computed(() =>
  props.results
    .filter(r => r.status === 'completed' && r.sea_blueness !== null)
    .sort((a, b) => a.timestamp - b.timestamp),
)

const chartOption = computed<EChartsOption>(() => {
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
      left: '5%',
      right: '5%',
      bottom: '10%',
      outerBounds: {
        bottom: '10%',
      },
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
        // --- 新增：添加标记线 ---
        markLine: {
          silent: true, // 标记线不响应鼠标事件
          symbol: 'none', // 两端不显示任何符号
          data: markLineLevels.map(item => ({
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
            },
          })),
        },
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

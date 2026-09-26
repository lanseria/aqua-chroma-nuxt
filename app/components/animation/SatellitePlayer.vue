<script lang="ts" setup>
import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'
import LayerPanel from './LayerPanel.vue'

interface PlayerLayer {
  label: string
  urls: string[]
}

const props = defineProps<{
  layers: PlayerLayer[]
  frames: AnalysisResult[]
  currentIndex: number
  fps?: number
  /** 悬停预览帧索引（图表 hover 时临时接管显示），null 时回落到当前播放帧 */
  previewIndex?: number | null
  /** 是否叠加陆地边界与城市标注 */
  annotated?: boolean
  /** 标注渲染配置（粗细、颜色、城市名等） */
  annotationConfig?: AnnotationConfig
}>()

// 实际展示帧：预览优先，其次播放进度
const activeIndex = computed(() => props.previewIndex ?? props.currentIndex)

// 多图层同步视图：每个面板独立铺满一格；单视图占满整个播放器
const isMultiLayer = computed(() => props.layers.length > 1)
const panelWrapClass = computed(() =>
  isMultiLayer.value ? 'grid h-full w-full grid-cols-1 lg:grid-cols-3 lg:gap-2 lg:p-2' : 'h-full w-full')
const panelItemClass = computed(() =>
  isMultiLayer.value ? 'min-h-0 aspect-square lg:aspect-auto lg:rounded-lg' : '')

const currentItem = computed(() => props.frames[activeIndex.value] ?? null)

// 海蓝程度显示：优先综合海蓝指数（新旧口径同义，均含云量折减）
const seaBluenessLabel = computed(() => {
  const v = currentItem.value?.blueness_index ?? currentItem.value?.sea_blueness
  return v != null ? `${(v * 100).toFixed(1)}%` : '--'
})
const cloudCoverageLabel = computed(() => {
  const v = currentItem.value?.cloud_coverage
  return v != null ? `${(v * 100).toFixed(1)}%` : '--'
})
</script>

<template>
  <div class="border border-gray-200 rounded-xl bg-gray-900 shadow-sm relative overflow-hidden dark:border-gray-700 dark:bg-black">
    <!-- 单视图铺满；多图层视图按格分区，移动端纵向堆叠 -->
    <div :class="panelWrapClass">
      <LayerPanel
        v-for="layer in layers"
        :key="layer.label"
        :class="panelItemClass"
        :urls="layer.urls"
        :active-index="activeIndex"
        :fps="fps"
        :label="isMultiLayer ? layer.label : undefined"
        :annotated="annotated"
        :annotation-config="annotationConfig"
      />
    </div>

    <!-- 覆盖信息层 -->
    <template v-if="currentItem">
      <div class="text-sm text-white font-mono px-2.5 py-1 rounded-md bg-black/50 left-3 top-3 backdrop-blur-sm">
        {{ format(fromUnixTime(currentItem.timestamp), 'yyyy-MM-dd HH:mm') }}
      </div>

      <div class="text-xs text-white/80 font-mono px-2.5 py-1 rounded-md bg-black/50 right-3 top-3 backdrop-blur-sm">
        {{ activeIndex + 1 }} / {{ frames.length }}
      </div>

      <div class="flex flex-wrap gap-2 bottom-3 left-3">
        <div class="text-sm text-white px-2.5 py-1 rounded-md bg-black/50 flex gap-1.5 items-center backdrop-blur-sm">
          <span class="rounded-full h-2 w-2 inline-block" style="background-color: #3b82f6" />
          海蓝程度
          <span class="font-bold font-mono">{{ seaBluenessLabel }}</span>
        </div>
        <div class="text-sm text-white px-2.5 py-1 rounded-md bg-black/50 flex gap-1.5 items-center backdrop-blur-sm">
          <span class="rounded-full bg-gray-400 h-2 w-2 inline-block" />
          云层覆盖率
          <span class="font-bold font-mono">{{ cloudCoverageLabel }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

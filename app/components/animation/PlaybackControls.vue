<script lang="ts" setup>
import { format, fromUnixTime } from 'date-fns'

defineProps<{
  isPlaying: boolean
  frameCount: number
  currentIndex: number
  currentTime?: number
  layerOptions: Array<{ label: string, value: string }>
}>()

const emit = defineEmits<{
  (e: 'toggle-play'): void
  (e: 'step', delta: number): void
  (e: 'seek', index: number): void
}>()

const fps = defineModel<number>('fps', { default: 4 })
const layer = defineModel<string>('layer', { default: '' })
const layout = defineModel<'single' | 'triple'>('layout', { default: 'single' })
const annotation = defineModel<boolean>('annotation', { default: false })
const config = defineModel<AnnotationConfig>('config', { required: true })

// 标注样式设置弹层：点击齿轮展开，点击面板外收起
const showSettings = ref(false)
const settingsRef = ref<HTMLElement | null>(null)
onClickOutside(settingsRef, () => {
  showSettings.value = false
})

// 关闭标注时同步收起设置面板
watch(annotation, (on) => {
  if (!on)
    showSettings.value = false
})

function patchConfig(patch: Partial<AnnotationConfig>) {
  config.value = { ...config.value, ...patch }
}

function onRangeInput(key: 'lineWidth' | 'fontSize', e: Event) {
  patchConfig({ [key]: Number((e.target as HTMLInputElement).value) } as Partial<AnnotationConfig>)
}

function onColorInput(key: 'lineColor' | 'labelColor', e: Event) {
  patchConfig({ [key]: (e.target as HTMLInputElement).value } as Partial<AnnotationConfig>)
}

// 边界线颜色快捷预设（含默认琥珀黄）
const lineColorPresets = ['#ffd600', '#22d3ee', '#4ade80', '#ff2d2d', '#ffffff']

const speedOptions = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '4x', value: 4 },
  { label: '8x', value: 8 },
  { label: '16x', value: 16 },
  { label: '32x', value: 32 },
]

const layoutOptions = [
  { label: '单视图', value: 'single' },
  { label: '三图同步', value: 'triple' },
]

// 三图同步展示全部图层，单图层选择无意义
const showLayerSelector = computed(() => layout.value !== 'triple')

function onScrub(e: Event) {
  emit('seek', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <div class="p-4 border border-gray-200 rounded-lg bg-white shadow-sm space-y-4 dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-wrap gap-x-4 gap-y-3 items-center">
      <!-- 传输控制 -->
      <div class="flex gap-2 items-center">
        <button
          aria-label="上一帧"
          class="text-gray-600 border border-gray-300 rounded-lg flex h-9 w-9 cursor-pointer transition-colors items-center justify-center dark:text-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          @click="emit('step', -1)"
        >
          <div class="i-carbon-skip-back-filled h-4 w-4" />
        </button>
        <button
          :aria-label="isPlaying ? '暂停' : '播放'"
          class="text-white rounded-full bg-teal-600 flex h-10 w-10 cursor-pointer shadow-sm transition-colors items-center justify-center hover:bg-teal-700"
          @click="emit('toggle-play')"
        >
          <div class="h-5 w-5" :class="isPlaying ? 'i-carbon-pause-filled' : 'i-carbon-play-filled'" />
        </button>
        <button
          aria-label="下一帧"
          class="text-gray-600 border border-gray-300 rounded-lg flex h-9 w-9 cursor-pointer transition-colors items-center justify-center dark:text-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          @click="emit('step', 1)"
        >
          <div class="i-carbon-skip-forward-filled h-4 w-4" />
        </button>
      </div>

      <div class="bg-gray-200 h-6 w-px hidden dark:bg-gray-700 sm:block" />

      <!-- 速度、视图布局与图层 -->
      <div class="flex flex-wrap gap-x-4 gap-y-2 items-center">
        <div class="flex gap-2 items-center">
          <span class="text-sm text-gray-500 flex-none">速度</span>
          <ButtonGroup v-model="fps" :options="speedOptions" />
        </div>
        <div class="flex gap-2 items-center">
          <span class="text-sm text-gray-500 flex-none">视图</span>
          <ButtonGroup v-model="layout" :options="layoutOptions" />
        </div>
        <div class="flex gap-2 items-center relative">
          <span class="text-sm text-gray-500 flex-none">标注</span>
          <button
            :aria-pressed="annotation"
            class="text-sm px-3 py-1.5 border rounded-lg cursor-pointer transition-colors duration-150"
            :class="annotation
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'"
            @click="annotation = !annotation"
          >
            {{ annotation ? '海岸线与城市' : '关闭' }}
          </button>
          <button
            v-if="annotation"
            aria-label="标注样式设置"
            title="标注样式设置"
            class="text-gray-500 border border-gray-300 rounded-lg flex h-8 w-8 cursor-pointer transition-colors items-center justify-center dark:text-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            :class="showSettings ? 'text-teal-600 border-teal-500' : ''"
            @click="showSettings = !showSettings"
          >
            <div class="i-carbon-settings h-4 w-4" />
          </button>

          <!-- 标注样式设置面板 -->
          <div
            v-if="showSettings"
            ref="settingsRef"
            class="mt-2 p-3 border border-gray-200 rounded-lg bg-white w-64 shadow-lg right-0 top-full absolute z-20 space-y-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600 dark:text-gray-300">显示城市名称</span>
              <button
                role="switch"
                :aria-checked="config.showCityNames"
                class="rounded-full h-5 w-9 cursor-pointer transition-colors relative"
                :class="config.showCityNames ? 'bg-teal-600' : 'bg-gray-300 dark:bg-gray-600'"
                @click="patchConfig({ showCityNames: !config.showCityNames })"
              >
                <span
                  class="rounded-full bg-white h-4 w-4 transition-transform left-0.5 top-0.5 absolute"
                  :class="config.showCityNames ? 'translate-x-4' : ''"
                />
              </button>
            </div>

            <div class="space-y-1">
              <div class="text-sm text-gray-600 flex justify-between dark:text-gray-300">
                <span>边界线粗细</span>
                <span class="text-xs text-gray-400 font-mono">{{ config.lineWidth.toFixed(1) }}</span>
              </div>
              <input
                type="range"
                class="accent-teal-600 w-full cursor-pointer"
                min="0.4"
                max="3"
                step="0.1"
                :value="config.lineWidth"
                aria-label="边界线粗细"
                @input="onRangeInput('lineWidth', $event)"
              >
            </div>

            <div class="space-y-1.5">
              <span class="text-sm text-gray-600 dark:text-gray-300">边界线颜色</span>
              <div class="flex gap-1.5 items-center">
                <button
                  v-for="color in lineColorPresets"
                  :key="color"
                  :aria-label="`边界线颜色 ${color}`"
                  class="border border-gray-300 rounded-full h-5 w-5 cursor-pointer transition-transform dark:border-gray-600 hover:scale-110"
                  :class="config.lineColor === color ? 'ring-2 ring-teal-500' : ''"
                  :style="{ backgroundColor: color }"
                  @click="patchConfig({ lineColor: color })"
                />
                <input
                  type="color"
                  class="border border-gray-300 rounded h-6 w-8 cursor-pointer dark:border-gray-600"
                  :value="config.lineColor"
                  aria-label="自定义边界线颜色"
                  @input="onColorInput('lineColor', $event)"
                >
              </div>
            </div>

            <div class="space-y-1">
              <div class="text-sm text-gray-600 flex justify-between dark:text-gray-300">
                <span>城市名字号</span>
                <span class="text-xs text-gray-400 font-mono">{{ config.fontSize.toFixed(1) }}</span>
              </div>
              <input
                type="range"
                class="accent-teal-600 w-full cursor-pointer"
                min="4"
                max="12"
                step="0.5"
                :value="config.fontSize"
                aria-label="城市名字号"
                @input="onRangeInput('fontSize', $event)"
              >
            </div>

            <div class="space-y-1.5">
              <span class="text-sm text-gray-600 dark:text-gray-300">城市名颜色</span>
              <input
                type="color"
                class="border border-gray-300 rounded h-6 w-8 cursor-pointer dark:border-gray-600"
                :value="config.labelColor"
                aria-label="城市名颜色"
                @input="onColorInput('labelColor', $event)"
              >
            </div>

            <button
              class="text-xs text-gray-400 cursor-pointer hover:text-teal-600"
              @click="config = { ...defaultAnnotationConfig }"
            >
              恢复默认样式
            </button>
          </div>
        </div>
        <div v-if="showLayerSelector" class="flex gap-2 items-center">
          <span class="text-sm text-gray-500 flex-none">图层</span>
          <ButtonGroup v-model="layer" :options="layerOptions" />
        </div>
      </div>
    </div>

    <!-- 进度条 -->
    <div class="flex gap-3 items-center">
      <span class="text-xs text-gray-500 font-mono flex-none w-22">
        {{ currentTime ? format(fromUnixTime(currentTime), 'MM-dd HH:mm') : '--:--' }}
      </span>
      <input
        type="range"
        class="accent-teal-600 flex-1 min-w-0 cursor-pointer"
        min="0"
        :max="Math.max(frameCount - 1, 0)"
        :value="currentIndex"
        aria-label="播放进度"
        @input="onScrub"
      >
      <span class="text-xs text-gray-500 font-mono flex-none">
        {{ frameCount > 0 ? `${currentIndex + 1} / ${frameCount}` : '0 / 0' }}
      </span>
    </div>

    <p class="text-xs text-gray-400 hidden sm:block">
      空格：播放/暂停，方向键：逐帧步进；悬停曲线预览对应帧，点击跳转
    </p>
  </div>
</template>

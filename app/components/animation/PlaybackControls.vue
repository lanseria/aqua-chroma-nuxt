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

const speedOptions = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '4x', value: 4 },
  { label: '8x', value: 8 },
  { label: '16x', value: 16 },
  { label: '32x', value: 32 },
]

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

      <!-- 速度与图层 -->
      <div class="flex flex-wrap gap-x-4 gap-y-2 items-center">
        <div class="flex gap-2 items-center">
          <span class="text-sm text-gray-500 flex-none">速度</span>
          <ButtonGroup v-model="fps" :options="speedOptions" />
        </div>
        <div class="flex gap-2 items-center">
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

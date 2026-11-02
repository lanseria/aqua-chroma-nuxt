<script lang="ts" setup>
// 标注样式设置：齿轮按钮 + 弹出设置面板，动画回放页与首页时间线三视图共用。
// 配置经 v-model:config 双向绑定，持久化由各页面自行处理（localStorage）。
const config = defineModel<AnnotationConfig>('config', { required: true })

// 面板开合为组件内部状态：点击齿轮切换，点击齿轮与面板以外的区域收起
const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)
onClickOutside(rootRef, () => {
  open.value = false
})

function patchConfig(patch: Partial<AnnotationConfig>) {
  config.value = {
    ...config.value,
    ...patch,
  }
}

function onRangeInput(key: 'lineWidth' | 'fontSize', e: Event) {
  patchConfig({
    [key]: Number((e.target as HTMLInputElement).value),
  } as Partial<AnnotationConfig>)
}

function onColorInput(key: 'lineColor' | 'labelColor', e: Event) {
  patchConfig({ [key]: (e.target as HTMLInputElement).value } as Partial<AnnotationConfig>)
}

// 边界线颜色快捷预设（含默认琥珀黄）
const lineColorPresets = [
  '#ffd600',
  '#22d3ee',
  '#4ade80',
  '#ff2d2d',
  '#ffffff',
]
</script>

<template>
  <div ref="rootRef" class="flex items-center relative">
    <button
      aria-label="标注样式设置"
      title="标注样式设置"
      class="text-gray-500 border border-gray-300 rounded-lg flex h-8 w-8 cursor-pointer transition-colors items-center justify-center dark:text-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
      :class="open ? 'text-teal-600 border-teal-500' : ''"
      @click="open = !open"
    >
      <div class="i-carbon-settings h-4 w-4" />
    </button>

    <!-- 标注样式设置面板 -->
    <div
      v-if="open"
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
</template>

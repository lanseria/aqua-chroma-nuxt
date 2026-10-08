<script lang="ts" setup>
const props = defineProps<{
  label: string
  percentage: number
  color: string
  // 自定义右侧展示文案（如能见度 "12.5 km"）；缺省展示 percentage%
  displayValue?: string
}>()

const shownValue = computed(() => props.displayValue ?? `${props.percentage.toFixed(1)}%`)
</script>

<template>
  <div>
    <div class="mb-1 flex justify-between">
      <span class="text-sm text-gray-700 font-medium dark:text-gray-300">{{ label }}</span>
      <span class="text-sm text-gray-700 font-medium dark:text-gray-300">{{ shownValue }}</span>
    </div>
    <div class="rounded-full bg-gray-200 h-2.5 w-full dark:bg-gray-700">
      <div
        class="rounded-full h-2.5 transition-all duration-500"
        :style="{ width: `${percentage}%`, backgroundColor: color }"
      />
    </div>
  </div>
</template>

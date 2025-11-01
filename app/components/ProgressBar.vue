<script lang="ts" setup>
defineProps<{
  label: string
  percentage: number
  color: string
}>()
</script>

<template>
  <div>
    <div class="mb-1 flex justify-between">
      <span class="text-sm text-gray-700 font-medium dark:text-gray-300">{{ label }}</span>
      <span class="text-sm text-gray-700 font-medium dark:text-gray-300">{{ percentage.toFixed(1) }}%</span>
    </div>
    <div class="rounded-full bg-gray-200 h-2.5 w-full dark:bg-gray-700">
      <div
        class="rounded-full h-2.5 transition-all duration-500"
        :style="{ width: `${percentage}%`, backgroundColor: color }"
      />
    </div>
  </div>
</template>

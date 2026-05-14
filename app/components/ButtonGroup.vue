<script setup lang="ts">
interface Option {
  label: string
  value: number | string
}

const _props = defineProps<{
  modelValue: number | string
  options: Option[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | string): void
  (e: 'change', value: number | string): void
}>()

function select(opt: Option) {
  emit('update:modelValue', opt.value)
  emit('change', opt.value)
}
</script>

<template>
  <div class="border border-gray-300 rounded-lg inline-flex overflow-hidden dark:border-gray-600">
    <button
      v-for="(opt, idx) in options"
      :key="opt.value"
      class="text-sm px-3 py-1.5 border-none cursor-pointer transition-colors duration-150"
      :class="[
        modelValue === opt.value
          ? 'bg-teal-600 text-white'
          : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
        idx > 0 ? 'border-l border-gray-300 dark:border-gray-600' : '',
      ]"
      @click="select(opt)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

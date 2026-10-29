<script setup lang="ts">
type Accent = 'amber' | 'blue' | 'slate' | 'teal'

const props = withDefaults(defineProps<{
  label: string
  value: string
  hint?: string
  icon?: string
  accent?: Accent
  progress?: number
}>(), {
  icon: 'i-carbon-chart-line',
  accent: 'teal',
  progress: 0,
})

const accentMap: Record<Accent, { icon: string, value: string, bar: string }> = {
  blue: {
    icon: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    value: 'text-blue-600 dark:text-blue-400',
    bar: '#3b82f6',
  },
  teal: {
    icon: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
    value: 'text-teal-600 dark:text-teal-400',
    bar: '#14b8a6',
  },
  amber: {
    icon: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    value: 'text-amber-600 dark:text-amber-400',
    bar: '#f59e0b',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    value: 'text-slate-700 dark:text-slate-200',
    bar: '#64748b',
  },
}

const tone = computed(() => accentMap[props.accent])
const clampedProgress = computed(() => Math.min(100, Math.max(0, props.progress)))
</script>

<template>
  <div class="p-4 border border-gray-200 rounded-xl bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="flex gap-2 items-center justify-between">
      <span class="text-xs text-gray-500 dark:text-gray-400">{{ label }}</span>
      <span class="rounded-lg flex flex-none h-8 w-8 items-center justify-center" :class="tone.icon">
        <span :class="icon" class="h-4 w-4" aria-hidden="true" />
      </span>
    </div>

    <div class="text-2xl font-bold font-mono mt-2" :class="tone.value">
      {{ value }}
    </div>

    <p class="text-xs text-gray-400 mt-1 truncate" :title="hint">
      {{ hint || '\u00A0' }}
    </p>

    <div class="mt-3 rounded-full bg-gray-100 h-1.5 overflow-hidden dark:bg-gray-700">
      <div
        class="rounded-full h-full transition-all duration-500"
        :style="{ width: `${clampedProgress}%`, backgroundColor: tone.bar }"
      />
    </div>
  </div>
</template>

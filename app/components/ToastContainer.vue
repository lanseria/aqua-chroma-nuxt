<script setup lang="ts">
import type { ToastItem } from '~/composables/useToast'

const { toasts, remove } = useToast()

const iconMap: Record<ToastItem['type'], string> = {
  success: 'i-carbon-checkmark-filled',
  error: 'i-carbon-close-filled',
  warning: 'i-carbon-warning-filled',
  info: 'i-carbon-information-filled',
  loading: 'i-carbon-circle-dash animate-spin',
}

const colorMap: Record<ToastItem['type'], string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  loading: 'text-teal-500',
}
</script>

<template>
  <Teleport to="body">
    <div class="flex flex-col gap-2 items-center left-1/2 top-4 fixed z-50 -translate-x-1/2">
      <TransitionGroup name="toast">
        <div
          v-for="item in toasts"
          :key="item.id"
          class="text-sm px-4 py-2.5 border border-gray-200 rounded-lg bg-white flex gap-2 max-w-90vw min-w-48 shadow-lg items-center dark:text-gray-100 dark:border-gray-700 dark:bg-gray-800"
        >
          <div class="flex-none h-4 w-4" :class="[iconMap[item.type], colorMap[item.type]]" />
          <span class="flex-1">{{ item.message }}</span>
          <button
            v-if="item.type !== 'loading'"
            class="i-carbon-close ml-2 opacity-40 h-3.5 w-3.5 cursor-pointer hover:opacity-80"
            @click="remove(item.id)"
          />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>

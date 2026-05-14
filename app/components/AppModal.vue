<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  title: string
  width?: string
  maskClosable?: boolean
}>(), {
  width: '600px',
  maskClosable: true,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

function close() {
  emit('update:open', false)
}

function onMaskClick() {
  if (props.maskClosable)
    close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape')
    close()
}

watch(() => props.open, (val) => {
  if (val)
    document.addEventListener('keydown', onKeydown)
  else
    document.removeEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="flex items-center inset-0 justify-center fixed z-40">
        <!-- mask -->
        <div class="bg-black/50 inset-0 absolute" @click="onMaskClick" />
        <!-- panel -->
        <div
          class="rounded-xl bg-white flex flex-col max-h-[85vh] shadow-2xl relative z-10 dark:bg-gray-800"
          :style="{ width }"
        >
          <!-- header -->
          <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between dark:border-gray-700">
            <h3 class="text-lg text-gray-800 font-semibold dark:text-gray-100">
              {{ title }}
            </h3>
            <button
              class="i-carbon-close text-gray-400 h-5 w-5 cursor-pointer transition-colors hover:text-gray-600 dark:hover:text-gray-200"
              @click="close"
            />
          </div>
          <!-- body -->
          <div class="px-6 py-4 max-h-[70vh] overflow-y-auto">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.25s ease;
}

.modal-enter-from .relative {
  transform: scale(0.95);
}

.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>

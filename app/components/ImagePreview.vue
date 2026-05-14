<script setup lang="ts">
const props = withDefaults(defineProps<{
  open: boolean
  images: Array<{ src: string, alt?: string }>
  initialIndex?: number
}>(), {
  initialIndex: 0,
})

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const currentIndex = ref(0)
const scale = ref(1)
const rotation = ref(0)

watch(() => props.open, (val) => {
  if (val) {
    currentIndex.value = props.initialIndex
    scale.value = 1
    rotation.value = 0
    document.addEventListener('keydown', onKeydown)
  }
  else {
    document.removeEventListener('keydown', onKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})

function close() {
  emit('update:open', false)
}

function prev() {
  if (props.images.length <= 1)
    return
  currentIndex.value = (currentIndex.value - 1 + props.images.length) % props.images.length
  resetTransform()
}

function next() {
  if (props.images.length <= 1)
    return
  currentIndex.value = (currentIndex.value + 1) % props.images.length
  resetTransform()
}

function zoomIn() {
  scale.value = Math.min(scale.value + 0.25, 5)
}

function zoomOut() {
  scale.value = Math.max(scale.value - 0.25, 0.25)
}

function rotateRight() {
  rotation.value = (rotation.value + 90) % 360
}

function resetTransform() {
  scale.value = 1
  rotation.value = 0
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape')
    close()
  else if (e.key === 'ArrowLeft')
    prev()
  else if (e.key === 'ArrowRight')
    next()
  else if (e.key === '+')
    zoomIn()
  else if (e.key === '-')
    zoomOut()
}

const transformStyle = computed(() => ({
  transform: `scale(${scale.value}) rotate(${rotation.value}deg)`,
}))
</script>

<template>
  <Teleport to="body">
    <Transition name="preview">
      <div v-if="open" class="bg-black/90 flex items-center inset-0 justify-center fixed z-50" @click="close">
        <!-- image -->
        <img
          :src="images[currentIndex]?.src"
          :alt="images[currentIndex]?.alt"
          class="max-h-85vh max-w-90vw transition-transform duration-200 object-contain"
          :style="transformStyle"
          @click.stop
        >

        <!-- close button -->
        <button
          class="i-carbon-close text-white/80 h-8 w-8 cursor-pointer transition-colors right-4 top-4 absolute hover:text-white"
          @click="close"
        />

        <!-- toolbar -->
        <div class="px-4 py-2 rounded-lg bg-white/10 flex gap-3 items-center bottom-6 left-1/2 absolute backdrop-blur-sm -translate-x-1/2">
          <button class="i-carbon-zoom-in text-white/80 h-5 w-5 cursor-pointer hover:text-white" @click.stop="zoomIn" />
          <button class="i-carbon-zoom-out text-white/80 h-5 w-5 cursor-pointer hover:text-white" @click.stop="zoomOut" />
          <button class="i-carbon-rotate text-white/80 h-5 w-5 cursor-pointer hover:text-white" @click.stop="rotateRight" />
          <span class="mx-1 bg-white/30 h-4 w-px" />
          <span class="text-sm text-white/60">{{ currentIndex + 1 }} / {{ images.length }}</span>
        </div>

        <!-- prev arrow -->
        <button
          v-if="images.length > 1"
          class="i-carbon-chevron-left text-white/60 h-8 w-8 cursor-pointer transition-colors left-4 top-1/2 absolute hover:text-white -translate-y-1/2"
          @click.stop="prev"
        />

        <!-- next arrow -->
        <button
          v-if="images.length > 1"
          class="i-carbon-chevron-right text-white/60 h-8 w-8 cursor-pointer transition-colors right-4 top-1/2 absolute hover:text-white -translate-y-1/2"
          @click.stop="next"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.preview-enter-active,
.preview-leave-active {
  transition: opacity 0.25s ease;
}

.preview-enter-from,
.preview-leave-to {
  opacity: 0;
}
</style>

<script setup lang="ts">
const colorMode = useColorMode()

const isDark = computed({
  get() {
    return colorMode.value === 'dark'
  },
  set(newValue) {
    colorMode.preference = newValue ? 'dark' : 'light'
  },
})

function toggleTheme() {
  isDark.value = !isDark.value
}
</script>

<template>
  <button
    class="icon-btn px-3 flex h-full items-center !outline-none hover:bg-gray-100 dark:hover:bg-gray-700"
    title="切换主题"
    @click="toggleTheme"
  >
    <div class="i-carbon-sun dark:i-carbon-moon" />
  </button>
</template>

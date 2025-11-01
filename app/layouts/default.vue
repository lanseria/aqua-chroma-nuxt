<script setup lang="ts">
import { appName } from '~/constants'
</script>

<template>
  <div class="text-gray-800 bg-gray-50 flex flex-col min-h-screen dark:text-gray-200 dark:bg-gray-900">
    <!-- Header -->
    <header class="border-b border-gray-200 bg-white/80 left-0 right-0 top-0 fixed z-10 backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/80">
      <nav class="mx-auto px-4 max-w-7xl lg:px-8 sm:px-6">
        <div class="flex h-16 items-center justify-between">
          <!-- 左侧：Logo 和应用名称 -->
          <div class="flex items-center">
            <NuxtLink to="/" class="text-xl font-bold flex gap-2 transition-colors items-center hover:text-teal-600">
              <div class="i-carbon-wave text-2xl" />
              <span>{{ appName }}</span>
            </NuxtLink>
          </div>

          <!-- 右侧：功能按钮 -->
          <div class="flex h-full items-center">
            <!-- 主题切换组件 -->
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>

    <!-- 主体内容区域 -->
    <main class="pt-16 flex-grow">
      <div class="mx-auto px-4 py-8 max-w-7xl lg:px-8 sm:px-6">
        <slot />
      </div>
    </main>

    <!-- 页脚 -->
    <footer class="text-sm text-gray-500 py-4 text-center border-t border-gray-200 dark:text-gray-400 dark:border-gray-700">
      © {{ new Date().getFullYear() }} {{ appName }}. All rights reserved.
    </footer>
  </div>
</template>

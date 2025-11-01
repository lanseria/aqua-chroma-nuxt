<script setup lang="ts">
import { appName } from '~/constants'

// 1. 获取 useColorMode 的实例
const colorMode = useColorMode()

// 2. 使用 watchEffect 来响应式地同步主题
//    这个 effect 会在客户端执行，并在 colorMode 的值变化时自动触发
watchEffect(() => {
  // 确保在客户端环境下执行
  if (typeof document !== 'undefined') {
    if (colorMode.value === 'dark') {
      // 设置为暗黑主题
      document.body.setAttribute('arco-theme', 'dark')
    }
    else {
      // 恢复为亮色主题 (包括 'light', 'system' 解析为 light 等情况)
      document.body.removeAttribute('arco-theme')
    }
  }
})

useHead({
  title: appName,
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
html,
body,
#__nuxt {
  height: 100vh;
  margin: 0;
  padding: 0;
}

/*
  这个样式依然很重要！
  它负责处理非 Arco 组件的背景和文字颜色，
  以及在 Arco 主题应用前的页面底色，防止亮色闪烁。
*/
html.dark {
  background: #222;
  color: white;
}
</style>

import type { MaybeRefOrGetter } from 'vue'

export interface UsePlaybackOptions {
  /** 初始播放速度（帧/秒），默认 4 */
  fps?: number
}

/**
 * 帧序列播放引擎：管理当前帧、播放/暂停、步进、跳转与循环。
 * 帧数来源可以是 getter，数据重载（切换时间区间）时自动回到开头并暂停。
 */
export function usePlayback(frameCount: MaybeRefOrGetter<number>, options: UsePlaybackOptions = {}) {
  const currentIndex = shallowRef(0)
  const isPlaying = shallowRef(false)
  const fps = shallowRef(options.fps ?? 4)

  let timer: ReturnType<typeof setInterval> | null = null

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  function startTimer() {
    stopTimer()
    timer = setInterval(() => {
      const count = toValue(frameCount)
      if (count <= 0) {
        pause()
        return
      }
      // 循环播放：到末尾回到开头
      currentIndex.value = (currentIndex.value + 1) % count
    }, 1000 / fps.value)
  }

  function play() {
    if (isPlaying.value || toValue(frameCount) <= 0)
      return
    isPlaying.value = true
    startTimer()
  }

  function pause() {
    if (!isPlaying.value)
      return
    isPlaying.value = false
    stopTimer()
  }

  function toggle() {
    if (isPlaying.value)
      pause()
    else
      play()
  }

  /** 步进（负数为后退），自动循环回绕 */
  function step(delta: number) {
    const count = toValue(frameCount)
    if (count <= 0)
      return
    currentIndex.value = ((currentIndex.value + delta) % count + count) % count
  }

  function seek(index: number) {
    const count = toValue(frameCount)
    if (count <= 0)
      return
    currentIndex.value = Math.min(Math.max(index, 0), count - 1)
  }

  // 速度变化时以新速度重启定时器
  watch(fps, () => {
    if (isPlaying.value)
      startTimer()
  })

  // 帧数变化（切换时间区间 / 数据重载）时回到开头并暂停
  watch(() => toValue(frameCount), () => {
    pause()
    currentIndex.value = 0
  })

  onUnmounted(stopTimer)

  return { currentIndex, isPlaying, fps, play, pause, toggle, step, seek }
}

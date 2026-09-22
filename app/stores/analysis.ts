import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 分析结果的数据结构
 */
export interface AnalysisResult {
  id?: number
  timestamp: number // Unix 时间戳 (秒)
  status: 'completed' | 'night' | string
  sea_blueness: number | null // 0-1 的浮点数或 null
  cloud_coverage: number | null // 0-1 的浮点数或 null
  output_directory: string
}

/**
 * 本项目 Nitro server 提供的数据接口（server/api/results.get.ts）
 * 同源调用，服务端在 server 侧直连 PostgreSQL。
 */
export const useAnalysisStore = defineStore('analysis', () => {
  const results = ref<AnalysisResult[]>([])
  const loadingProgress = ref(0) // 用于展示加载进度的条数

  // 支持传入 days (天数)
  async function fetchResults(days: number = 7) {
    loadingProgress.value = 0
    results.value = [] // 清空旧数据

    try {
      const response = await $fetch<{ code: number, data: Array<Omit<AnalysisResult, 'output_directory'>>, msg: string }>(
        '/api/results',
        {
          method: 'GET',
          query: { days },
        },
      )

      if (response.code !== 200)
        throw new Error(response.msg || '接口返回异常')

      // 格式化数据（服务端已按 timestamp 倒序返回）
      results.value = response.data.map(item => ({
        ...item,
        output_directory: `output/${item.timestamp}`,
      }))
      loadingProgress.value = results.value.length
    }
    catch (error: any) {
      console.error('获取分析结果时发生错误:', error)
      const toast = useToast()
      toast.error(`获取数据失败: ${error.message}`)
    }
    finally {
      loadingProgress.value = 0
    }
  }

  return {
    results,
    loadingProgress,
    fetchResults,
  }
})

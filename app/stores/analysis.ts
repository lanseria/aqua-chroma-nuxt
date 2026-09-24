import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 分析结果的数据结构
 *
 * 指标口径（metric_version）：
 * - v1（存量历史数据）: sea_blueness = 蓝水像素 / 全部海洋像素（含云，受云量压制）
 * - v2（新口径）: sea_blueness = 蓝水 / 可见水体（与云量无关），
 *    blueness_index = sea_blueness * (1 - cloud_coverage) 承接 v1 的综合语义
 */
export interface AnalysisResult {
  id?: number
  timestamp: number // Unix 时间戳 (秒)
  status: 'completed' | 'cloudy' | 'night' | string
  metric_version: number // 1 = 旧口径（含云），2 = 新口径（可见水体）
  sea_blueness: number | null // 0-1 的浮点数或 null
  cloud_coverage: number | null // 0-1 的浮点数或 null
  blueness_index: number | null // 综合海蓝指数（仅 v2 / 已回填的 v1-completed 有值）
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
      // metric_version 兜底为 1（该列加入之前的极老记录视为旧口径）
      results.value = response.data.map(item => ({
        ...item,
        metric_version: item.metric_version ?? 1,
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

  // 删除指定时间戳的记录，成功后同步移除本地列表
  async function deleteResult(timestamp: number) {
    const toast = useToast()
    try {
      const response = await $fetch<{ code: number, msg: string }>(
        `/api/results/${timestamp}`,
        { method: 'DELETE' },
      )

      if (response.code !== 200)
        throw new Error(response.msg || '接口返回异常')

      results.value = results.value.filter(item => item.timestamp !== timestamp)
      toast.success('已删除该条数据')
    }
    catch (error: any) {
      console.error('删除分析结果时发生错误:', error)
      toast.error(`删除失败: ${error.message}`)
    }
  }

  return {
    results,
    loadingProgress,
    fetchResults,
    deleteResult,
  }
})

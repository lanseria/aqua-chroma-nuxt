import { Message } from '@arco-design/web-vue'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { request } from '~/composables/api/axios/request'

/**
 * 分析结果的数据结构 (已更新)
 */
export interface AnalysisResult {
  // id 字段在新结构中没有，如果后端列表接口会提供，请保留
  // 如果确实没有，可以考虑用 timestamp 作为 key
  // id: string;
  timestamp: number // 从 ISO 字符串变更为 Unix 时间戳 (秒)
  status: 'completed' | 'night' // 状态更新
  sea_blueness: number | null // 新字段名，类型为 0-1 的浮点数或 null
  cloud_coverage: number | null // 类型为 0-1 的浮点数或 null
  output_directory: string
}

export const useAnalysisStore = defineStore('analysis', () => {
  const results = ref<AnalysisResult[]>([])

  async function fetchResults() {
    try {
      const { code, data, msg }: R<AnalysisResult[]> = await request.get('/api/results')

      // --- 修改点：判断 code === 200 ---
      if (code === 200) {
        // --- 修改点：按数字时间戳降序排序 ---
        results.value = data.sort((a, b) => b.timestamp - a.timestamp)
      }
      else {
        Message.error(`获取分析结果失败: ${msg}`)
      }
    }
    catch (error) {
      console.error('获取分析结果时发生错误:', error)
      Message.error('网络错误，无法获取分析结果')
    }
  }

  async function triggerDebugAnalysis(timestamp: number) {
    try {
      const { data } = await request.post(`/api/debug/analyze/${timestamp}`)
      Message.success('调试分析任务已触发')
      return data
    }
    catch (error: any) {
      console.error('触发调试分析时发生错误:', error)
      Message.error(`触发失败: ${error.message}`)
      return null
    }
  }

  return {
    results,
    fetchResults,
    triggerDebugAnalysis,
  }
})

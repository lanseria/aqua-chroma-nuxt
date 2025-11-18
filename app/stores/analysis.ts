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
      const supabase = useSupabase()
      // 从 Supabase 获取数据
      const { data, error } = await supabase
        .from('analysis_results')
        .select('timestamp, status, sea_blueness, cloud_coverage')
        .order('timestamp', { ascending: false })

      if (error) {
        Message.error(`获取分析结果失败: ${error.message}`)
        return // 出现错误时停止执行
      }

      // 格式化数据以匹配现有的 AnalysisResult 接口
      const formattedData: AnalysisResult[] = data.map(item => ({
        timestamp: item.timestamp,
        status: item.status as 'completed' | 'night',
        sea_blueness: item.sea_blueness,
        cloud_coverage: item.cloud_coverage,
        // 注意: 'output_directory' 字段在数据库中不存在。
        // 我们在客户端根据时间戳构造它，以确保图片 URL 能正常工作。
        // 这个值是根据项目约定推断的 'results/<timestamp>' 格式。
        output_directory: `data/output/${item.timestamp}`,
      }))

      // 按时间戳降序排序
      results.value = formattedData.sort((a, b) => b.timestamp - a.timestamp)
    }
    catch (error) {
      console.error('获取分析结果时发生错误:', error)
      Message.error('网络错误，无法获取分析结果')
    }
  }

  async function triggerDebugAnalysis(timestamp: number) {
    try {
      const { data } = await request.get(`/api/debug/analyze/${timestamp}`)
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

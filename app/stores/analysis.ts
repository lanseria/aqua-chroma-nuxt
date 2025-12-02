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
  const loadingProgress = ref(0) // 新增：用于展示加载进度的条数

  // 支持传入 days (天数)
  async function fetchResults(days: number = 7) {
    loadingProgress.value = 0
    results.value = [] // 清空旧数据

    const BATCH_SIZE = 1000
    const dayjs = useDayjs()
    // 计算截止时间 (startTime)
    const cutoffTimestamp = days > 0 ? dayjs().subtract(days, 'day').unix() : 0

    let lastTimestamp = dayjs().unix() + 3600 // 初始设为一个未来的时间，确保能拉到最新的
    let hasMore = true
    let allData: any[] = []

    try {
      const supabase = useSupabase()

      while (hasMore) {
        // 查询：时间戳小于上次的最后一条，且大于截止时间
        const { data, error } = await supabase
          .from('analysis_results')
          .select('timestamp, status, sea_blueness, cloud_coverage')
          .lt('timestamp', lastTimestamp) // Less Than (游标核心)
          .gte('timestamp', cutoffTimestamp) // Greater Than or Equal (截止时间)
          .order('timestamp', { ascending: false })
          .limit(BATCH_SIZE)

        if (error) {
          throw error
        }

        if (!data || data.length === 0) {
          hasMore = false
          break
        }

        // 追加数据
        allData = [...allData, ...data]
        loadingProgress.value = allData.length // 更新进度

        // 更新游标
        lastTimestamp = data[data.length - 1]!.timestamp

        // 如果本次拉取不满 1000 条，说明已经到底了
        if (data.length < BATCH_SIZE) {
          hasMore = false
        }
      }

      // 格式化数据
      const formattedData: AnalysisResult[] = allData.map(item => ({
        timestamp: item.timestamp,
        status: item.status as 'completed' | 'night',
        sea_blueness: item.sea_blueness,
        cloud_coverage: item.cloud_coverage,
        output_directory: `data/output/${item.timestamp}`,
      }))

      // 赋值给状态
      results.value = formattedData // 已经按时间倒序排列了，因为是追加的
    }
    catch (error: any) {
      console.error('获取分析结果时发生错误:', error)
      Message.error(`获取数据失败: ${error.message}`)
    }
    finally {
      loadingProgress.value = 0
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
    loadingProgress,
    fetchResults,
    triggerDebugAnalysis,
  }
})

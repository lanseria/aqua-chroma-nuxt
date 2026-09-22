import { subDays } from 'date-fns'
import { queryResults } from '../utils/db'

/**
 * GET /api/results?days=7
 * 分析结果查询接口，替代原 Supabase 直连查询。
 * 游标分页：timestamp 倒序，从当前时间向前翻页。
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const days = Number(query.days ?? 7) || 0
  const BATCH_SIZE = 1000

  // 与原 Supabase 查询语义一致：days>0 时只取最近 N 天；游标从"未来一小时"开始
  const cutoffTimestamp = days > 0
    ? Math.floor(subDays(new Date(), days).getTime() / 1000)
    : 0
  let lastTimestamp = Math.floor(Date.now() / 1000) + 3600

  const allRows: Awaited<ReturnType<typeof queryResults>> = []
  let hasMore = true

  while (hasMore) {
    const rows = await queryResults(cutoffTimestamp, lastTimestamp, BATCH_SIZE)
    if (rows.length === 0)
      break

    allRows.push(...rows)
    lastTimestamp = rows[rows.length - 1]!.timestamp

    if (rows.length < BATCH_SIZE)
      hasMore = false
  }

  return {
    code: 200,
    data: allRows,
    msg: 'Success',
  }
})

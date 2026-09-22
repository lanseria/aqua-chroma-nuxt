import { deleteResultByTimestamp } from '../../utils/db'

/**
 * DELETE /api/results/:timestamp
 * 删除指定时间戳的分析结果记录（用于清理异常数据）。
 */
export default defineEventHandler(async (event) => {
  const timestamp = Number(getRouterParam(event, 'timestamp'))

  if (!Number.isInteger(timestamp) || timestamp <= 0)
    throw createError({ statusCode: 400, statusMessage: 'Invalid timestamp' })

  const deleted = await deleteResultByTimestamp(timestamp)
  if (!deleted)
    throw createError({ statusCode: 404, statusMessage: 'Record not found' })

  return {
    code: 200,
    data: { timestamp },
    msg: 'Deleted',
  }
})

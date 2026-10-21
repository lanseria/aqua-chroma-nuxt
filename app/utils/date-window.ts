import { addDays, format, parseISO, startOfDay } from 'date-fns'

/**
 * 本地时区下某自然日的半开区间 [startOfDay, startOfNextDay)，单位：Unix 秒。
 * 与「用 format(ts, 'yyyy-MM-dd') 过滤日期」的口径一致（含 DST 时区），
 * 首页趋势图日期聚焦与动画回放日期聚焦共用。
 */
export function dayWindow(date: string) {
  const start = startOfDay(parseISO(date))
  return {
    start: Math.floor(start.getTime() / 1000),
    end: Math.floor(addDays(start, 1).getTime() / 1000),
  }
}

/**
 * 当前本地日期（yyyy-MM-dd）。按需调用，避免页面跨天常驻后日期上限/未来日期判断过期。
 */
export function todayString() {
  return format(new Date(), 'yyyy-MM-dd')
}

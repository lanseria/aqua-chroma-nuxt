import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'

/** 能见度上限 35km（与后端 config.VISIBILITY_MAX_KM 一致） */
export const VISIBILITY_MAX_KM = 35

export interface BluenessLevel {
  name: string
  threshold: number
  color: string
}

const LOW_BLUENESS_LEVEL: BluenessLevel = { name: '略显浑浊', threshold: 0, color: '#ef4444' }

/** 海蓝分级描述（与趋势图虚线阈值一致），供图表图例、提示与分享海报共用 */
export const BLUENESS_LEVELS: BluenessLevel[] = [
  { name: '湛蓝如镜', threshold: 80, color: '#10b981' },
  { name: '清澈蔚蓝', threshold: 60, color: '#3b82f6' },
  { name: '碧波荡漾', threshold: 40, color: '#f59e0b' },
  LOW_BLUENESS_LEVEL,
]

/** 按数值归入分级描述；低于 40% 统一视为「略显浑浊」 */
export function getBluenessLevel(value: number): BluenessLevel {
  return BLUENESS_LEVELS.find(level => value >= level.threshold) ?? LOW_BLUENESS_LEVEL
}

/** 图例用的区间文案：最低档覆盖 0% 到下一档阈值（略显浑浊 <40%） */
export function bluenessLevelRange(level: BluenessLevel): string {
  const sorted = [...BLUENESS_LEVELS].sort((a, b) => a.threshold - b.threshold)
  const index = sorted.findIndex(item => item.name === level.name)
  const next = sorted[index + 1]
  if (!next)
    return `≥${level.threshold}%`
  if (index === 0)
    return `<${next.threshold}%`
  return `${level.threshold}–${next.threshold}%`
}

/**
 * 海蓝程度取值：优先使用综合海蓝指数 blueness_index（v1/v2 同义，均含云量折减）；
 * 极老记录回填缺失时退回 sea_blueness（v1 口径本身即含云折减，语义一致）。
 */
export function bluenessPercent(result: AnalysisResult): number {
  const value = result.blueness_index ?? result.sea_blueness
  return (value ?? 0) * 100
}

/** 是否具备可绘制的指标（夜间 / 无指标记录被排除） */
function isChartPoint(result: AnalysisResult): boolean {
  return result.sea_blueness !== null || result.visibility_km !== null
}

/**
 * 趋势图数据：按时间升序排列；传入 focusDate 时只保留该自然日 00:00–24:00 的点。
 * 页面统计与图表共用同一口径，避免摘要和曲线对不上。
 */
export function chartResults(results: AnalysisResult[], focusDate?: string | null): AnalysisResult[] {
  const points = results
    .filter(isChartPoint)
    .sort((a, b) => a.timestamp - b.timestamp)

  if (!focusDate)
    return points

  return points.filter(result => format(fromUnixTime(result.timestamp), 'yyyy-MM-dd') === focusDate)
}

/**
 * 区间摘要：有效点数、最新一条记录，以及海蓝 / 云量 / 能见度的均值与峰值。
 * 云层遮蔽记录的能见度按口径记 0（占位值），计算均值时排除，避免明显低估。
 */
export function computeSeriesStats(items: AnalysisResult[]) {
  const blueness = items.map(bluenessPercent)
  const cloud = items
    .map(result => result.cloud_coverage)
    .filter((value): value is number => value !== null)
    .map(value => value * 100)
  const visibility = items
    .filter(result => result.visibility_level !== '云层遮蔽')
    .map(result => result.visibility_km)
    .filter((value): value is number => value !== null)

  const average = (values: number[]) =>
    values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null

  const latest = items[items.length - 1] ?? null

  return {
    count: items.length,
    latest,
    latestBlueness: latest
      ? bluenessPercent(latest)
      : null,
    latestCloud: latest?.cloud_coverage != null
      ? latest.cloud_coverage * 100
      : null,
    latestVisibility: latest?.visibility_km ?? null,
    latestVisibilityLevel: latest?.visibility_level ?? null,
    latestHaze: latest?.haze_score ?? null,
    avgBlueness: average(blueness),
    maxBlueness: blueness.length
      ? Math.max(...blueness)
      : null,
    avgCloud: average(cloud),
    avgVisibility: average(visibility),
  }
}

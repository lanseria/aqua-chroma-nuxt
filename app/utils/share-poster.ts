import type { AnalysisResult } from '~/stores/analysis'
import { format, fromUnixTime } from 'date-fns'
import { BLUENESS_LEVELS, bluenessPercent, getBluenessLevel, VISIBILITY_MAX_KM } from './analysis-metrics'

export type PosterFormat = '3:4' | '9:16'
export type PosterSlide = 'cover' | 'triple' | 'stats'

export type PosterUrls = Record<PosterSlide, string>

export interface PosterRenderInput {
  result: AnalysisResult
  trend: AnalysisResult[]
  trendLabel: string
  apiUrl: string
  format: PosterFormat
}

export interface PosterSize {
  width: number
  height: number
}

type Ctx = CanvasRenderingContext2D

const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Segoe UI", sans-serif'

const PALETTE = {
  background: '#04121b',
  backgroundDeep: '#01080d',
  text: '#e7f7f4',
  muted: '#8fb3ba',
  panel: 'rgba(255, 255, 255, 0.045)',
  border: 'rgba(255, 255, 255, 0.10)',
  teal: '#2dd4bf',
  blue: '#38bdf8',
  slate: '#94a3b8',
  amber: '#fbbf24',
  red: '#f87171',
}

interface ScaleSegment {
  from: number
  to: number
  color: string
  label: string
}

function buildScaleSegments(): ScaleSegment[] {
  const sorted = [...BLUENESS_LEVELS].sort((a, b) => a.threshold - b.threshold)
  const segments: ScaleSegment[] = []

  sorted.forEach((level, index) => {
    const next = sorted[index + 1]
    segments.push({
      // 最低档覆盖 0% 到下一档阈值，避免出现没有描述的空白区间
      from: index === 0
        ? 0
        : level.threshold,
      to: next ? next.threshold : 100,
      color: level.color,
      label: level.name,
    })
  })

  return segments
}

const SCALE_SEGMENTS = buildScaleSegments()

const imageCache = new Map<string, Promise<HTMLImageElement | null>>()

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx)
    throw new Error('Canvas 2D context unavailable')
  return { canvas, ctx }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(url)
  if (cached)
    return cached

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = url
  })
  imageCache.set(url, promise)
  return promise
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function setFont(ctx: Ctx, size: number, weight = '400') {
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`
}

interface TextOptions {
  weight?: string
  align?: CanvasTextAlign
  baseline?: CanvasTextBaseline
}

function drawText(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  options: TextOptions = {},
) {
  setFont(ctx, size, options.weight)
  ctx.fillStyle = color
  ctx.textAlign = options.align ?? 'left'
  ctx.textBaseline = options.baseline ?? 'alphabetic'
  ctx.fillText(value, x, y)
}

function wrapText(ctx: Ctx, value: string, maxWidth: number) {
  const lines: string[] = []
  for (const paragraph of value.split('\n')) {
    let line = ''
    for (const char of paragraph) {
      const test = line + char
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line)
        line = char
      }
      else {
        line = test
      }
    }
    lines.push(line)
  }
  return lines
}

function drawParagraph(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color: string,
  lineHeight: number,
  options: TextOptions = {},
) {
  setFont(ctx, size, options.weight)
  ctx.fillStyle = color
  ctx.textAlign = options.align ?? 'left'
  ctx.textBaseline = 'alphabetic'
  wrapText(ctx, value, maxWidth).forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight)
  })
}

function roundedRect(ctx: Ctx, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function paintBackground(ctx: Ctx, width: number, height: number) {
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#051f2a')
  gradient.addColorStop(0.55, PALETTE.background)
  gradient.addColorStop(1, PALETTE.backgroundDeep)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const tealGlow = ctx.createRadialGradient(width * 0.86, height * 0.08, 0, width * 0.86, height * 0.08, width * 0.7)
  tealGlow.addColorStop(0, 'rgba(45, 212, 191, 0.18)')
  tealGlow.addColorStop(1, 'rgba(45, 212, 191, 0)')
  ctx.fillStyle = tealGlow
  ctx.fillRect(0, 0, width, height)

  const blueGlow = ctx.createRadialGradient(width * 0.08, height * 0.92, 0, width * 0.08, height * 0.92, width * 0.6)
  blueGlow.addColorStop(0, 'rgba(56, 189, 248, 0.10)')
  blueGlow.addColorStop(1, 'rgba(56, 189, 248, 0)')
  ctx.fillStyle = blueGlow
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.035)'
  for (let x = 40; x < width; x += 48) {
    for (let y = 40; y < height; y += 48) {
      ctx.beginPath()
      ctx.arc(x, y, 1, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function drawHeader(ctx: Ctx, width: number, result: AnalysisResult) {
  const time = format(fromUnixTime(result.timestamp), 'yyyy.MM.dd HH:mm')
  drawText(ctx, 'AQUA CHROMA · 海蓝之心观测台', 72, 92, 22, PALETTE.teal, { weight: '600' })
  drawText(ctx, time, width - 72, 92, 22, PALETTE.muted, { align: 'right' })
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(72, 120)
  ctx.lineTo(width - 72, 120)
  ctx.stroke()
}

function drawFooter(ctx: Ctx, width: number, height: number) {
  const y = height - 78
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(72, y - 24)
  ctx.lineTo(width - 72, y - 24)
  ctx.stroke()
  drawText(ctx, '数据来自卫星图像分析 · Aqua Chroma 海蓝之心监控', 72, y, 18, PALETTE.muted)
  drawText(ctx, 'AQUA-CHROMA', width - 72, y, 18, 'rgba(143, 179, 186, 0.55)', { align: 'right', weight: '600' })
}

function drawChip(ctx: Ctx, x: number, y: number, label: string, color: string, fontSize = 24) {
  setFont(ctx, fontSize, '600')
  const textWidth = ctx.measureText(label).width
  const height = fontSize + 24
  const width = textWidth + 36
  roundedRect(ctx, x, y, width, height, height / 2)
  ctx.fillStyle = hexToRgba(color, 0.16)
  ctx.fill()
  ctx.strokeStyle = hexToRgba(color, 0.45)
  ctx.lineWidth = 2
  ctx.stroke()
  drawText(ctx, label, x + 18, y + height / 2, fontSize, color, { weight: '600', baseline: 'middle' })
  return { width, height }
}

/** 叠在图片上的标签：深色半透明底 + 白字，避免浅色卫星图上看不清 */
function drawOverlayChip(ctx: Ctx, x: number, y: number, label: string, fontSize = 18) {
  setFont(ctx, fontSize, '600')
  const textWidth = ctx.measureText(label).width
  const height = fontSize + 20
  const width = textWidth + 28
  roundedRect(ctx, x, y, width, height, height / 2)
  ctx.fillStyle = 'rgba(2, 10, 15, 0.62)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  drawText(ctx, label, x + 14, y + height / 2, fontSize, '#ffffff', { weight: '600', baseline: 'middle' })
  return { width, height }
}

function drawImageCover(ctx: Ctx, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = (image.width - sourceWidth) / 2
  const sourceY = (image.height - sourceHeight) / 2
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

function drawImagePanel(
  ctx: Ctx,
  image: HTMLImageElement | null,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.save()
  roundedRect(ctx, x, y, width, height, radius)
  ctx.clip()
  ctx.fillStyle = '#071b23'
  ctx.fillRect(x, y, width, height)
  if (image) {
    drawImageCover(ctx, image, x, y, width, height)
  }
  else {
    drawText(ctx, '图像暂不可用', x + width / 2, y + height / 2, 24, PALETTE.muted, { align: 'center', baseline: 'middle' })
  }
  ctx.restore()

  ctx.save()
  roundedRect(ctx, x, y, width, height, radius)
  ctx.strokeStyle = PALETTE.border
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

function drawMetric(ctx: Ctx, x: number, y: number, label: string, value: string, color: string) {
  drawText(ctx, label, x, y, 22, PALETTE.muted)
  drawText(ctx, value, x, y + 54, 44, color, { weight: '700' })
  ctx.fillStyle = hexToRgba(color, 0.35)
  ctx.fillRect(x, y + 72, 120, 3)
}

function drawLevelScale(ctx: Ctx, x: number, y: number, width: number, value: number) {
  const barHeight = 14
  const gap = 6
  const usableWidth = width - gap * (SCALE_SEGMENTS.length - 1)
  drawText(ctx, '海蓝分级', x, y - 22, 22, PALETTE.muted)

  let cursor = x
  for (const segment of SCALE_SEGMENTS) {
    const segmentWidth = usableWidth * (segment.to - segment.from) / 100
    roundedRect(ctx, cursor, y, segmentWidth, barHeight, barHeight / 2)
    ctx.fillStyle = hexToRgba(segment.color, segment.label ? 0.9 : 0.3)
    ctx.fill()
    if (segment.label) {
      drawText(ctx, segment.label, cursor + segmentWidth / 2, y + barHeight + 30, 20, PALETTE.muted, { align: 'center' })
    }
    cursor += segmentWidth + gap
  }

  const clampedValue = Math.min(100, Math.max(0, value))
  const markerX = x + 8 + (width - 16) * clampedValue / 100
  ctx.beginPath()
  ctx.arc(markerX, y + barHeight / 2, 11, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(markerX, y + barHeight / 2, 4.5, 0, Math.PI * 2)
  ctx.fillStyle = PALETTE.background
  ctx.fill()
}

function drawTrendPanel(
  ctx: Ctx,
  input: PosterRenderInput,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  roundedRect(ctx, x, y, width, height, 26)
  ctx.fillStyle = PALETTE.panel
  ctx.fill()
  ctx.strokeStyle = PALETTE.border
  ctx.lineWidth = 2
  ctx.stroke()

  drawText(ctx, input.trendLabel, x + 36, y + 52, 26, PALETTE.text, { weight: '600' })

  const values = input.trend.map(bluenessPercent)
  if (values.length < 2) {
    drawText(ctx, '走势数据不足', x + 36, y + 120, 24, PALETTE.muted)
    return
  }

  const maximum = Math.max(20, Math.ceil(Math.max(...values) / 10) * 10)
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  drawText(
    ctx,
    `最高 ${Math.max(...values).toFixed(1)}% · 平均 ${average.toFixed(1)}%`,
    x + width - 36,
    y + 52,
    20,
    PALETTE.muted,
    { align: 'right' },
  )

  const plotX = x + 36
  const plotY = y + 100
  const plotWidth = width - 72
  const plotHeight = height - 170

  for (let index = 0; index <= 3; index++) {
    const gridY = plotY + plotHeight * index / 3
    ctx.beginPath()
    ctx.moveTo(plotX, gridY)
    ctx.lineTo(plotX + plotWidth, gridY)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  drawText(ctx, `${maximum}%`, plotX + 6, plotY + 18, 18, PALETTE.muted)

  const points = values.map((value, index) => ({
    x: plotX + plotWidth * index / (values.length - 1),
    y: plotY + plotHeight * (1 - value / maximum),
  }))

  const areaGradient = ctx.createLinearGradient(0, plotY, 0, plotY + plotHeight)
  areaGradient.addColorStop(0, 'rgba(56, 189, 248, 0.30)')
  areaGradient.addColorStop(1, 'rgba(56, 189, 248, 0.01)')
  ctx.beginPath()
  ctx.moveTo(points[0]!.x, plotY + plotHeight)
  for (const point of points) {
    ctx.lineTo(point.x, point.y)
  }
  ctx.lineTo(points[points.length - 1]!.x, plotY + plotHeight)
  ctx.closePath()
  ctx.fillStyle = areaGradient
  ctx.fill()

  ctx.beginPath()
  points.forEach((point, index) => {
    if (index === 0)
      ctx.moveTo(point.x, point.y)
    else
      ctx.lineTo(point.x, point.y)
  })
  ctx.strokeStyle = PALETTE.blue
  ctx.lineWidth = 4
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()

  const selectedIndex = input.trend.findIndex(item => item.timestamp === input.result.timestamp)
  const selectedPoint = points[selectedIndex]
  if (selectedPoint) {
    ctx.beginPath()
    ctx.moveTo(selectedPoint.x, plotY)
    ctx.lineTo(selectedPoint.x, plotY + plotHeight)
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.55)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 8])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.beginPath()
    ctx.arc(selectedPoint.x, selectedPoint.y, 9, 0, Math.PI * 2)
    ctx.fillStyle = PALETTE.teal
    ctx.fill()
    ctx.beginPath()
    ctx.arc(selectedPoint.x, selectedPoint.y, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }

  const first = input.trend[0]
  const last = input.trend[input.trend.length - 1]
  if (first && last) {
    drawText(ctx, format(fromUnixTime(first.timestamp), 'MM-dd HH:mm'), plotX, plotY + plotHeight + 30, 18, PALETTE.muted)
    drawText(
      ctx,
      format(fromUnixTime(last.timestamp), 'MM-dd HH:mm'),
      plotX + plotWidth,
      plotY + plotHeight + 30,
      18,
      PALETTE.muted,
      { align: 'right' },
    )
  }
}

function drawStatCard(
  ctx: Ctx,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  color: string,
  progress: number,
) {
  roundedRect(ctx, x, y, width, height, 22)
  ctx.fillStyle = PALETTE.panel
  ctx.fill()
  ctx.strokeStyle = PALETTE.border
  ctx.lineWidth = 2
  ctx.stroke()

  drawText(ctx, label, x + 28, y + 44, 20, PALETTE.muted)
  drawText(ctx, value, x + 28, y + 102, 38, PALETTE.text, { weight: '700' })

  const barX = x + 28
  const barY = y + height - 34
  const barWidth = width - 56
  roundedRect(ctx, barX, barY, barWidth, 8, 4)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.fill()

  const filled = barWidth * Math.min(1, Math.max(0, progress))
  if (filled > 0) {
    roundedRect(ctx, barX, barY, filled, 8, 4)
    ctx.fillStyle = color
    ctx.fill()
  }
}

function cloudPercent(result: AnalysisResult) {
  return result.cloud_coverage == null
    ? null
    : result.cloud_coverage * 100
}

function formatPercent(value: number | null) {
  return value == null
    ? '--'
    : `${value.toFixed(1)}%`
}

function visibilityLabel(result: AnalysisResult) {
  return result.visibility_km == null
    ? '--'
    : `${result.visibility_km.toFixed(1)} km`
}

function hazeLabel(result: AnalysisResult) {
  return result.haze_score == null
    ? '--'
    : result.haze_score.toFixed(2)
}

function renderCover(input: PosterRenderInput, image: HTMLImageElement | null, size: PosterSize) {
  const { canvas, ctx } = makeCanvas(size.width, size.height)
  const { width, height } = size
  const padding = 72
  const contentWidth = width - padding * 2
  const tall = height > 1500

  paintBackground(ctx, width, height)
  drawHeader(ctx, width, input.result)

  drawText(ctx, '这一刻，', padding, 220, 70, PALETTE.text, { weight: '700' })
  drawText(ctx, '海是什么颜色？', padding, 312, 70, PALETTE.text, { weight: '700' })

  const blueness = bluenessPercent(input.result)
  const level = getBluenessLevel(blueness)
  const chip = drawChip(ctx, padding, 352, level.name, level.color, 26)
  drawText(
    ctx,
    `综合海蓝指数 ${blueness.toFixed(1)}%`,
    padding + chip.width + 24,
    352 + chip.height / 2,
    24,
    PALETTE.muted,
    { baseline: 'middle' },
  )

  const imageY = 440
  const imageHeight = tall
    ? 780
    : 540
  drawImagePanel(ctx, image, padding, imageY, contentWidth, imageHeight, 28)
  drawOverlayChip(ctx, padding + 24, imageY + 24, '卫星原图', 18)

  const metricsY = imageY + imageHeight + 90
  drawMetric(ctx, padding, metricsY, '云层覆盖率', formatPercent(cloudPercent(input.result)), PALETTE.slate)
  drawMetric(ctx, padding + contentWidth * 0.36, metricsY, '能见度', visibilityLabel(input.result), PALETTE.teal)
  drawMetric(ctx, padding + contentWidth * 0.7, metricsY, '大气浑浊度', hazeLabel(input.result), PALETTE.amber)

  if (tall) {
    drawText(ctx, '「海色每天都不一样，', padding, height - 460, 30, PALETTE.muted)
    drawText(ctx, '  记录它，就是记录大海的情绪。」', padding, height - 412, 30, PALETTE.muted)
  }

  drawLevelScale(ctx, padding, tall
    ? height - 300
    : height - 236, contentWidth, blueness)
  drawFooter(ctx, width, height)
  return canvas
}

function drawClassificationPanel(ctx: Ctx, x: number, y: number, width: number, height: number) {
  roundedRect(ctx, x, y, width, height, 20)
  ctx.fillStyle = PALETTE.panel
  ctx.fill()
  ctx.strokeStyle = PALETTE.border
  ctx.lineWidth = 2
  ctx.stroke()

  drawText(ctx, '分类图例', x + 28, y + 52, 22, PALETTE.muted)
  const legend = [
    { label: '云', color: '#e2e8f0' },
    { label: '蓝水', color: '#38bdf8' },
    { label: '黄水', color: '#fbbf24' },
  ]
  legend.forEach((item, index) => {
    const itemY = y + 104 + index * 42
    ctx.beginPath()
    ctx.arc(x + 38, itemY - 7, 8, 0, Math.PI * 2)
    ctx.fillStyle = item.color
    ctx.fill()
    drawText(ctx, item.label, x + 58, itemY, 22, PALETTE.text)
  })

  drawParagraph(
    ctx,
    '同一片海，在三种视角里呈现出不同的纹理与层次。',
    x + 28,
    y + 290,
    width - 56,
    22,
    PALETTE.muted,
    34,
  )
}

function renderTriple(
  input: PosterRenderInput,
  images: Array<HTMLImageElement | null>,
  size: PosterSize,
) {
  const { canvas, ctx } = makeCanvas(size.width, size.height)
  const { width, height } = size
  const padding = 72
  const contentWidth = width - padding * 2
  const tall = height > 1500

  paintBackground(ctx, width, height)
  drawHeader(ctx, width, input.result)

  drawText(ctx, '三重视角，看见这片海', padding, 220, 58, PALETTE.text, { weight: '700' })

  const blueness = bluenessPercent(input.result)
  const level = getBluenessLevel(blueness)
  const chip = drawChip(ctx, padding, 270, level.name, level.color, 24)
  drawText(
    ctx,
    `综合海蓝指数 ${blueness.toFixed(1)}%`,
    padding + chip.width + 22,
    270 + chip.height / 2,
    22,
    PALETTE.muted,
    { baseline: 'middle' },
  )

  const views = [
    { label: '原图', detail: '原始输入' },
    { label: '高清化', detail: 'Real-ESRGAN 4×' },
    { label: '分类结果', detail: '云 / 蓝水 / 黄水' },
  ]
  const gap = 24
  let metricsY = 0

  if (tall) {
    // 9:16 空间更高：改成 2×2 网格，让三视图更大，并用分类图例填补第四格
    const cell = (contentWidth - gap) / 2
    const gridY = 360
    const positions = [
      { x: padding, y: gridY },
      { x: padding + cell + gap, y: gridY },
      { x: padding, y: gridY + cell + gap },
    ]

    images.forEach((image, index) => {
      const view = views[index]
      const position = positions[index]
      if (!view || !position)
        return
      drawImagePanel(ctx, image, position.x, position.y, cell, cell, 20)
      drawOverlayChip(ctx, position.x + 16, position.y + 16, view.label, 18)
    })

    drawClassificationPanel(ctx, padding + cell + gap, gridY + cell + gap, cell, cell)
    metricsY = gridY + cell * 2 + gap + 64
  }
  else {
    const imageWidth = (contentWidth - gap * 2) / 3
    const imageY = 370

    images.forEach((image, index) => {
      const view = views[index]
      if (!view)
        return
      const x = padding + index * (imageWidth + gap)
      drawImagePanel(ctx, image, x, imageY, imageWidth, imageWidth, 20)
      drawOverlayChip(ctx, x + 16, imageY + 16, view.label, 18)
      drawText(ctx, view.detail, x + imageWidth / 2, imageY + imageWidth + 38, 22, PALETTE.muted, { align: 'center' })
    })

    metricsY = imageY + imageWidth + 120
  }

  drawMetric(ctx, padding, metricsY, '云层覆盖率', formatPercent(cloudPercent(input.result)), PALETTE.slate)
  drawMetric(ctx, padding + contentWidth * 0.36, metricsY, '能见度', visibilityLabel(input.result), PALETTE.teal)
  drawMetric(ctx, padding + contentWidth * 0.7, metricsY, '大气浑浊度', hazeLabel(input.result), PALETTE.amber)

  if (tall) {
    drawText(ctx, '「海色每天都不一样，', padding, height - 420, 30, PALETTE.muted)
    drawText(ctx, '  记录它，就是记录大海的情绪。」', padding, height - 372, 30, PALETTE.muted)
  }
  else {
    drawParagraph(
      ctx,
      '同一片海，在原图、高清化与分类结果里，呈现出完全不同的纹理与层次。',
      padding,
      metricsY + 130,
      contentWidth,
      26,
      PALETTE.muted,
      40,
    )
  }

  drawLevelScale(ctx, padding, tall
    ? height - 260
    : height - 320, contentWidth, blueness)
  drawFooter(ctx, width, height)
  return canvas
}

function renderStats(input: PosterRenderInput, size: PosterSize) {
  const { canvas, ctx } = makeCanvas(size.width, size.height)
  const { width, height } = size
  const padding = 72
  const contentWidth = width - padding * 2
  const tall = height > 1500

  paintBackground(ctx, width, height)
  drawHeader(ctx, width, input.result)

  drawText(ctx, '这一刻的数据切片', padding, 220, 58, PALETTE.text, { weight: '700' })

  const blueness = bluenessPercent(input.result)
  const level = getBluenessLevel(blueness)
  const chip = drawChip(ctx, padding, 270, level.name, level.color, 24)
  drawText(
    ctx,
    `综合海蓝指数 ${blueness.toFixed(1)}%`,
    padding + chip.width + 22,
    270 + chip.height / 2,
    22,
    PALETTE.muted,
    { baseline: 'middle' },
  )

  const panelY = 350
  const panelHeight = tall
    ? 540
    : 400
  drawTrendPanel(ctx, input, padding, panelY, contentWidth, panelHeight)

  const gridY = panelY + panelHeight + 44
  const cardGap = 24
  const cardWidth = (contentWidth - cardGap) / 2
  const cardHeight = tall
    ? 170
    : 150
  const cloud = cloudPercent(input.result)

  drawStatCard(ctx, padding, gridY, cardWidth, cardHeight, '综合海蓝指数', `${blueness.toFixed(1)}%`, level.color, blueness / 100)
  drawStatCard(ctx, padding + cardWidth + cardGap, gridY, cardWidth, cardHeight, '云层覆盖率', formatPercent(cloud), PALETTE.slate, (cloud ?? 0) / 100)
  drawStatCard(ctx, padding, gridY + cardHeight + cardGap, cardWidth, cardHeight, '能见度', visibilityLabel(input.result), PALETTE.teal, (input.result.visibility_km ?? 0) / VISIBILITY_MAX_KM)
  drawStatCard(ctx, padding + cardWidth + cardGap, gridY + cardHeight + cardGap, cardWidth, cardHeight, '大气浑浊度', hazeLabel(input.result), PALETTE.amber, input.result.haze_score ?? 0)

  if (tall) {
    drawText(ctx, '「海色每天都不一样，', padding, height - 500, 30, PALETTE.muted)
    drawText(ctx, '  记录它，就是记录大海的情绪。」', padding, height - 452, 30, PALETTE.muted)
  }

  drawLevelScale(ctx, padding, tall
    ? height - 340
    : height - 246, contentWidth, blueness)
  drawFooter(ctx, width, height)
  return canvas
}

export function posterSize(format: PosterFormat): PosterSize {
  return format === '9:16'
    ? { width: 1080, height: 1920 }
    : { width: 1080, height: 1440 }
}

export async function renderPosterSet(input: PosterRenderInput): Promise<PosterUrls> {
  const base = `${input.apiUrl}/${input.result.output_directory}`
  const [inputImage, superImage, classImage] = await Promise.all([
    loadImage(`${base}/01_input_processed.png`),
    loadImage(`${base}/01b_superresolved.png`),
    loadImage(`${base}/04_hsv_classification.png`),
  ])
  const size = posterSize(input.format)

  return {
    cover: renderCover(input, inputImage, size).toDataURL('image/png'),
    triple: renderTriple(input, [inputImage, superImage, classImage], size).toDataURL('image/png'),
    stats: renderStats(input, size).toDataURL('image/png'),
  }
}

const LEVEL_HOOKS: Record<string, string> = {
  湛蓝如镜: '今天的海，湛蓝如镜，像一块被阳光擦亮的蓝宝石。',
  清澈蔚蓝: '清澈蔚蓝的海面，远处的海岸线清晰可见。',
  碧波荡漾: '碧波荡漾，海色温柔，云影在海面上慢慢移动。',
  略显浑浊: '海色略显浑浊，云层与海雾给海面蒙上一层柔光。',
}

export function buildCaption(result: AnalysisResult): string {
  const time = format(fromUnixTime(result.timestamp), 'yyyy年MM月dd日 HH:mm')
  const blueness = bluenessPercent(result)
  const level = getBluenessLevel(blueness)
  const cloud = cloudPercent(result)
  const visibility = result.visibility_km
  const hook = LEVEL_HOOKS[level.name] ?? '记录这一刻的海色。'

  const cloudText = cloud == null
    ? '云层数据暂缺。'
    : cloud >= 70
      ? `云层覆盖率 ${cloud.toFixed(1)}%，海色在云影里若隐若现。`
      : cloud <= 20
        ? `云层覆盖率仅 ${cloud.toFixed(1)}%，天空与海面都很通透。`
        : `云层覆盖率 ${cloud.toFixed(1)}%，海面光线柔和。`

  const visibilityText = visibility == null
    ? '能见度暂无估算。'
    : visibility >= 30
      ? `能见度 ${visibility.toFixed(1)} km，视野通透。`
      : visibility >= 15
        ? `能见度 ${visibility.toFixed(1)} km，远处略带薄雾。`
        : `能见度 ${visibility.toFixed(1)} km，海雾较明显。`

  const hazeText = result.haze_score == null
    ? ''
    : `大气浑浊度 ${result.haze_score.toFixed(2)}。`

  return [
    `🌊 海蓝之心 · ${time}`,
    hook,
    '',
    `综合海蓝指数 ${blueness.toFixed(1)}%｜${level.name}`,
    cloudText,
    visibilityText,
    hazeText,
    '',
    '在卫星影像里，记录每一次海色变化。',
    '#海蓝之心 #海洋观测 #卫星影像 #AquaChroma #今日海色',
  ].filter(Boolean).join('\n')
}

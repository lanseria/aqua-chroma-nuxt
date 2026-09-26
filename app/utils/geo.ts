// 监测区域地理定义与墨卡托投影，供动画回放页的地图标注叠加层使用。
// 常量与后端 aqua-chroma (app/config.py 的 TARGET_AREA / CITY_POINTS) 保持一致，
// 修改监测区域时两端需同步更新。

/** 监测区域经纬度边界（zoom 7 墨卡托瓦片裁剪范围） */
export const MONITOR_BOUNDS = {
  north: 31.168,
  south: 29.609,
  west: 121.102,
  east: 122.871,
}

/**
 * 标注叠加层的渲染画布（viewBox 单位）。
 * zoom 7 下该边界的理论瓦片像素为 161.02 x 164.51，后端按整数裁剪为 161 x 164，
 * 与所有 pipeline 输出图（322x328、1288x1312 ...）宽高比一致，保证叠加层与图片对齐。
 */
export const MAP_VIEW_W = 161
export const MAP_VIEW_H = 164

/** 监测范围内的城市点位（经纬度与后端一致；anchor/dx/dy 控制名称相对点位的排布） */
export interface CityPoint {
  name: string
  lon: number
  lat: number
  /** 靠近图幅右缘的城市改为向左排布，避免名称被裁掉 */
  anchor?: 'start' | 'middle' | 'end'
  /** 名称相对点位的偏移（画布单位），缺省按 anchor 自动取默认值 */
  dx?: number
  dy?: number
}

export const CITY_POINTS: CityPoint[] = [
  { name: '枸杞岛', lon: 122.818, lat: 30.722, anchor: 'end' },
  // 嵊泗与枸杞岛几乎同纬度且相邻，名称改排到点位下方避免互相挤占
  { name: '嵊泗', lon: 122.451, lat: 30.735, anchor: 'middle', dy: 4 },
  { name: '洋山港', lon: 122.064, lat: 30.633 },
  { name: '岱山', lon: 122.204, lat: 30.243 },
  { name: '定海', lon: 122.107, lat: 30.020 },
  { name: '沈家门', lon: 122.304, lat: 29.949 },
  { name: '宁波', lon: 121.551, lat: 29.869 },
  // 杭州湾北岸（上海市域）：市中心在图幅外，取湾岸可见的片区点位
  { name: '上海', lon: 121.910, lat: 30.890 },
  { name: '奉贤', lon: 121.630, lat: 30.920 },
  { name: '金山', lon: 121.340, lat: 30.740 },
]

/** 地图标注渲染配置（动画回放页可调，持久化到 localStorage） */
export interface AnnotationConfig {
  /** 是否显示城市名称 */
  showCityNames: boolean
  /** 陆地边界描边宽度（画布单位，1 单位 ≈ 图幅宽度 1/161） */
  lineWidth: number
  /** 陆地边界描边颜色 */
  lineColor: string
  /** 城市名称字号（画布单位） */
  fontSize: number
  /** 城市名称文字颜色（外描边保持白色以保证海上可读） */
  labelColor: string
}

export const defaultAnnotationConfig: AnnotationConfig = {
  showCityNames: true,
  lineWidth: 0.8,
  lineColor: '#ffd600',
  fontSize: 6.5,
  labelColor: '#191919',
}

/** 纬度 → 墨卡托 Y（与后端 geo_utils.mercator_y 相同公式） */
export function mercatorY(latDeg: number): number {
  const latRad = (latDeg * Math.PI) / 180
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2))
}

const mercNorth = mercatorY(MONITOR_BOUNDS.north)
const mercSouth = mercatorY(MONITOR_BOUNDS.south)

/** 经纬度 → 渲染画布坐标（经度线性映射，纬度墨卡托插值；y 轴向下） */
export function projectToMap(lat: number, lon: number): { x: number, y: number } {
  const x = ((lon - MONITOR_BOUNDS.west) / (MONITOR_BOUNDS.east - MONITOR_BOUNDS.west)) * MAP_VIEW_W
  const y = ((mercatorY(lat) - mercNorth) / (mercSouth - mercNorth)) * MAP_VIEW_H
  return { x, y }
}

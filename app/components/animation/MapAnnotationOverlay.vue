<script lang="ts" setup>
// 地图标注叠加层：陆地边界描边 + 城市点位。
// 样式与数据对齐后端 aqua-chroma 的 01_input_annotated.png（琥珀黄描边 + 黑色光晕、
// 红点城市 + 白描边中文名），但作为矢量叠加层渲染在任意图层之上。
// viewBox 宽高比与 pipeline 输出图一致，配合 preserveAspectRatio="xMidYMid meet"
// 与 object-contain 的图片逐像素对齐。

interface GeoPolygon {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

interface GeoFeature {
  geometry: GeoPolygon
}

const props = defineProps<{
  /** 渲染配置（缺省字段落回默认值） */
  config?: AnnotationConfig
}>()

// 陆地边界 path（模块级缓存：三图同步视图下三个叠加层实例共享同一次 fetch 与解析）
const landPath = shallowRef('')

let landPathPromise: Promise<string> | null = null

async function loadLandPath(): Promise<string> {
  landPathPromise ??= fetch('/geo/monitor_area.geojson')
    .then(res => res.json() as Promise<{ features: GeoFeature[] }>)
    .then((geojson) => {
      const d: string[] = []
      for (const feature of geojson.features) {
        const geom = feature.geometry
        if (!geom)
          continue
        const polygons: number[][][][] = geom.type === 'MultiPolygon'
          ? geom.coordinates as number[][][][]
          : [geom.coordinates as number[][][]]
        for (const polygon of polygons) {
          // 外包矩形预过滤：跳过与监测范围完全不相交的多边形（与后端一致）
          const pts = polygon.flat()
          const lons = pts.map(p => p[0]!)
          const lats = pts.map(p => p[1]!)
          if (Math.max(...lons) < MONITOR_BOUNDS.west || Math.min(...lons) > MONITOR_BOUNDS.east
            || Math.max(...lats) < MONITOR_BOUNDS.south || Math.min(...lats) > MONITOR_BOUNDS.north) {
            continue
          }
          for (const ring of polygon) {
            if (ring.length < 3)
              continue
            const seg = ring.map(([lon, lat]) => {
              const { x, y } = projectToMap(lat!, lon!)
              return `${x.toFixed(1)} ${y.toFixed(1)}`
            })
            d.push(`M${seg.join('L')}Z`)
          }
        }
      }
      return d.join('')
    })
    .catch((err) => {
      console.warn('[MapAnnotationOverlay] 陆地边界数据加载失败', err)
      return ''
    })
  return landPathPromise
}

onMounted(async () => {
  landPath.value = await loadLandPath()
})

// 渲染配置：合并默认值，保证旧 localStorage 数据缺少新字段时仍可渲染
const style = computed<AnnotationConfig>(() => ({ ...defaultAnnotationConfig, ...props.config }))

// 光晕保持与主线约 3:1 的比例（与后端 halo_thickness/thickness 一致），但不少于 1.5
const haloWidth = computed(() => Math.max(1.5, style.value.lineWidth * 3))

const cities = CITY_POINTS.map((city) => {
  const { x, y } = projectToMap(city.lat, city.lon)
  const anchor = city.anchor ?? 'start'
  // 名称默认排在点位右侧并垂直居中，锚点方向不同时自动取对应偏移
  const dx = city.dx ?? (anchor === 'end' ? -2.2 : anchor === 'middle' ? 0 : 2.2)
  const dy = city.dy ?? 1
  return { ...city, x, y, anchor, dx, dy }
})

// 裁剪区域 id 需实例唯一：三图同步视图下多个叠加层共用同一文档
const clipId = useId()
</script>

<template>
  <svg
    class="h-full w-full pointer-events-none inset-0 absolute"
    :viewBox="`0 0 ${MAP_VIEW_W} ${MAP_VIEW_H}`"
    preserveAspectRatio="xMidYMid meet"
  >
    <!-- GeoJSON 行政边界远大于监测范围，溢出 viewBox 的部分必须裁掉，
         否则会画到 object-contain 的 letterbox 空白区 -->
    <defs>
      <clipPath :id="clipId">
        <rect x="0" y="0" :width="MAP_VIEW_W" :height="MAP_VIEW_H" />
      </clipPath>
    </defs>
    <g :clip-path="`url(#${clipId})`">
      <!-- 陆地边界：黑色光晕 + 主描边（默认配色与后端 LAND_OUTLINE 一致） -->
      <path
        v-if="landPath"
        :d="landPath"
        fill="none"
        stroke="#000"
        :stroke-width="haloWidth"
        stroke-linejoin="round"
        opacity="0.55"
      />
      <path
        v-if="landPath"
        :d="landPath"
        fill="none"
        :stroke="style.lineColor"
        :stroke-width="style.lineWidth"
        stroke-linejoin="round"
      />

      <!-- 城市点位：白环红点 + 白描边名称（与后端 CITY_MARKER 配色一致） -->
      <g
        v-for="city in cities"
        :key="city.name"
        :transform="`translate(${city.x} ${city.y})`"
      >
        <circle r="1.5" fill="#fff" />
        <circle r="0.9" fill="#ff2d2d" />
        <text
          v-if="style.showCityNames"
          :x="city.dx"
          :y="city.dy"
          :text-anchor="city.anchor"
          :fill="style.labelColor"
          :font-size="`${style.fontSize}px`"
          style="paint-order: stroke;
            stroke: #fff;
            stroke-width: 1.2;
            font-family: system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif;
            font-weight: 600;"
        >{{ city.name }}</text>
      </g>
    </g>
  </svg>
</template>

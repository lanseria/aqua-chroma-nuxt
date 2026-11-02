<script lang="ts" setup>
// 地图标注叠加层：陆地边界描边 + 城市点位。
// 样式与数据对齐后端 aqua-chroma 的 01_input_annotated.png（琥珀黄描边 + 黑色光晕、
// 红点城市 + 白描边中文名），但作为矢量叠加层渲染在任意图层之上。
// viewBox 宽高比与 pipeline 输出图一致，preserveAspectRatio 随 fit 参数
// （meet 对齐 object-contain 图片，slice 对齐 object-cover 图片）逐像素对齐。

const props = defineProps<{
  /** 渲染配置（缺省字段落回默认值） */
  config?: AnnotationConfig
  /** 与底层图片的缩放对齐方式：meet 对应 object-contain，slice 对应 object-cover */
  fit?: 'meet' | 'slice'
}>()

const preserveAspectRatio = computed(() => `xMidYMid ${props.fit ?? 'meet'}`)

// 陆地边界 path（loadMonitorLandPath 模块级缓存：三图同步视图下多个叠加层实例共享同一次 fetch 与解析）
const landPath = shallowRef('')

onMounted(async () => {
  landPath.value = await loadMonitorLandPath()
})

// 渲染配置：合并默认值，保证旧 localStorage 数据缺少新字段时仍可渲染
const style = computed<AnnotationConfig>(() => ({
  ...defaultAnnotationConfig,
  ...props.config,
}))

// 光晕保持与主线约 3:1 的比例（与后端 halo_thickness/thickness 一致），但不少于 1.5
const haloWidth = computed(() => Math.max(1.5, style.value.lineWidth * 3))

const cities = CITY_POINTS.map((city) => {
  const { x, y } = projectToMap(city.lat, city.lon)
  const anchor = city.anchor ?? 'start'
  // 名称默认排在点位右侧并垂直居中，锚点方向不同时自动取对应偏移
  const dx = city.dx ?? (anchor === 'end'
    ? -2.2
    : anchor === 'middle'
      ? 0
      : 2.2)
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
    :preserveAspectRatio="preserveAspectRatio"
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

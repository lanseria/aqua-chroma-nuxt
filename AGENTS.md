## Project Overview

Aqua Chroma（海蓝之心监控）— 基于 Nuxt 4 的实时监控仪表板，可视化展示图像分析后的"海蓝程度"、"云层覆盖率"和"能见度"数据。SSR 已关闭（SPA 模式），部署在 Netlify。

## Commands

```bash
pnpm dev           # 开发服务器
pnpm build         # 生产构建
pnpm preview       # 预览生产构建
pnpm generate      # 静态站点预渲染
pnpm lint          # ESLint 检查
pnpm typecheck     # TypeScript 类型检查
```

## Tech Stack

- **Framework**: Nuxt 4 (Vue 3, SPA mode — `ssr: false`)
- **Language**: TypeScript
- **UI**: Arco Design Vue + UnoCSS
- **Charts**: ECharts (via `nuxt-echarts`, canvas renderer)
- **State**: Pinia
- **Database**: PostgreSQL via Nitro server routes (`pg` pool, no ORM)
- **HTTP**: Axios (with interceptors for debug API)
- **Styling**: UnoCSS atomic classes, `@nuxtjs/color-mode` for dark/light themes
- **Linting**: `@antfu/eslint-config` with UnoCSS and Vue rules
- **PWA**: `@vite-pwa/nuxt`

## Architecture

### Data Flow

1. **PostgreSQL** (Nitro server-side) is the primary data source — the server route `server/api/results.get.ts` queries the `analysis_results` table directly using `pg` with cursor-based pagination (batch size 1000, ordered by `timestamp DESC`); the Pinia store (`analysisStore`) fetches it via same-origin `/api/results?days=N`.
2. **Axios** is used only for the debug API (`/api/debug/analyze/:timestamp`) — the base URL switches between `/api` (dev proxy) and the production URL based on `import.meta.env.DEV`.
3. **Images** are served from the backend at `${apiUrl}/output/${timestamp}/` with files like `01_input_processed.png` and `04_hsv_classification.png`.

### Key Data Model

```typescript
interface AnalysisResult {
  timestamp: number // Unix timestamp (seconds)
  status: 'completed' | 'cloudy' | 'night'
  sea_blueness: number | null // 0-1
  cloud_coverage: number | null // 0-1
  blueness_index: number | null // 综合海蓝指数 = sea_blueness × (1 − cloud_coverage)
  visibility_km: number | null // 能见度估算（公里）；云层遮蔽记 0，NULL = 旧记录/无法估算
  visibility_level: string | null // 良好/中等/轻度霾雾/浓雾/云层遮蔽
  haze_score: number | null // 大气浑浊度 0-1（0 极通透，1 浓雾）
  output_directory: string
}
```

### Page Structure

- `app/pages/index.vue` — realtime overview dashboard; 区间指标摘要、重设计后的趋势图，以及悬停曲线联动的三视图 (`TimelinePreview`) 预览。
- `app/pages/history.vue` — 历史记录页；包含无限滚动卡片网格、单点调试、批量下载与详情弹窗。
- `app/pages/share.vue` — 图文工坊；选择观测时刻生成 3:4 / 9:16 社交海报（封面 / 三视图 / 数据），支持编辑文案、单张下载和 ZIP 打包。
- `app/pages/animation.vue` — 动画回放页。
- `app/pages/[...all].vue` — catch-all route.
- `app/layouts/default.vue` — includes navigation (`/share`, `/history`, `/animation`), `ThemeToggle` and `ProgressBar`.

### Component Roles

- `TrendChart` — ECharts line chart with zoom, hover-to-preview and click-to-select timestamp; 双 Y 轴（左 %，右 km），绘制海蓝程度、云层覆盖率、能见度三条曲线。
- `TimelinePreview` — index 页的 3 视图联动预览；展示悬停时刻的原图 / 高清化 / 分类结果及关键指标，可打开详情或跳转图文工坊。
- `MetricTile` — index 页的区间指标摘要卡，带图标、进度条与辅助说明。
- `AnalysisCard` — single result card with before/after images; 能见度进度条按 km/35km 比例渲染（`VISIBILITY_MAX_KM`），`visibility_km` 为 null 的旧记录不展示该行。
- `DebugResultViewer` — modal content for debug analysis results; 含能见度/大气浑浊度字段与 `05_dark_channel.png` 调试图。
- `ThemeToggle` — dark/light switch synced with Arco Design.
- `ProgressBar` — top-of-page loading progress indicator; 支持 `displayValue` 覆盖右侧百分比文案（能见度显示 km）。
- `app/utils/analysis-metrics.ts` — 趋势图、区间摘要与分享海报共享的取值、海蓝分级、过滤与统计口径。
- `app/utils/share-poster.ts` — Canvas 海报渲染（封面 / 三视图 / 数据）与社交文案生成。

### Database Access

`server/utils/db.ts` holds a shared `pg` Pool built from `DATABASE_URL`; `server/api/results.get.ts` exposes `GET /api/results?days=N` (same-origin, consumed by the Pinia store). No client-side database access.

## Environment Variables

```env
NUXT_PUBLIC_API_URL=
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

## Conventions

- Vue components use `<script setup lang="ts">` with PascalCase imports in templates (enforced by ESLint).
- ESLint uses `@antfu/eslint-config` — run `pnpm lint` before committing.
- Package manager is pnpm (v10), using catalog protocol for dependency versioning.
- ECharts imports are tree-shaken via `nuxt-echarts` config in `nuxt.config.ts` — only register needed chart types and components.

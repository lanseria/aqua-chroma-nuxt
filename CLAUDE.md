# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Aqua Chroma（海蓝之心监控）— 基于 Nuxt 4 的实时监控仪表板，可视化展示图像分析后的"海蓝程度"和"云层覆盖率"数据。SSR 已关闭（SPA 模式），部署在 Netlify。

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
- **Database**: Supabase (direct client query, no ORM)
- **HTTP**: Axios (with interceptors for debug API)
- **Styling**: UnoCSS atomic classes, `@nuxtjs/color-mode` for dark/light themes
- **Linting**: `@antfu/eslint-config` with UnoCSS and Vue rules
- **PWA**: `@vite-pwa/nuxt`

## Architecture

### Data Flow

1. **Supabase** is the primary data source — the Pinia store (`analysisStore`) queries `analysis_results` table directly using cursor-based pagination (batch size 1000, ordered by `timestamp DESC`).
2. **Axios** is used only for the debug API (`/api/debug/analyze/:timestamp`) — the base URL switches between `/api` (dev proxy) and the production URL based on `import.meta.env.DEV`.
3. **Images** are served from the backend at `${apiUrl}/data/output/${timestamp}/` with files like `01_input_processed.png` and `04_hsv_classification.png`.

### Key Data Model

```typescript
interface AnalysisResult {
  timestamp: number // Unix timestamp (seconds)
  status: 'completed' | 'night'
  sea_blueness: number | null // 0-1
  cloud_coverage: number | null // 0-1
  output_directory: string
}
```

### Page Structure

- `app/pages/index.vue` — the only meaningful page; contains the trend chart, debug tool, batch download, and infinite-scroll card grid.
- `app/pages/[...all].vue` — catch-all route.
- `app/layouts/default.vue` — includes `ThemeToggle` and `ProgressBar`.

### Component Roles

- `TrendChart` — ECharts line chart with zoom, click-to-select timestamp.
- `AnalysisCard` — single result card with before/after images.
- `DebugResultViewer` — modal content for debug analysis results.
- `ThemeToggle` — dark/light switch synced with Arco Design.
- `ProgressBar` — top-of-page loading progress indicator.

### Supabase Client

Created in `app/composables/useSupabase.ts` — reads `supabaseUrl` and `supabaseKey` from Nuxt runtime config. No server-side Supabase usage.

## Environment Variables

```env
NUXT_PUBLIC_API_URL=https://aqua-chroma.sharee.top
NUXT_PUBLIC_SUPABASE_URL=<url>
NUXT_PUBLIC_SUPABASE_KEY=<key>
```

## Conventions

- Vue components use `<script setup lang="ts">` with PascalCase imports in templates (enforced by ESLint).
- ESLint uses `@antfu/eslint-config` — run `pnpm lint` before committing.
- Package manager is pnpm (v10), using catalog protocol for dependency versioning.
- ECharts imports are tree-shaken via `nuxt-echarts` config in `nuxt.config.ts` — only register needed chart types and components.

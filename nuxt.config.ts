import { pwa } from './app/config/pwa'
import { appDescription } from './app/constants/index'

export default defineNuxtConfig({
  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@vite-pwa/nuxt',
    '@nuxt/eslint',
    'nuxt-echarts',
  ],

  ssr: false,

  devtools: { enabled: false },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
        { rel: 'apple-touch-icon', href: '/logo.png' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: appDescription },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: 'white' },
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#222222' },
      ],
    },
  },

  colorMode: {
    classSuffix: '',
  },

  runtimeConfig: {
    public: {
      apiUrl: '', // can be overridden by NUXT_PUBLIC_API_URL environment variable
      supabaseUrl: '',
      supabaseKey: '',
      platform: '', // set to 'netlify' via NUXT_PUBLIC_PLATFORM to hide debug tools and card list
    },
  },

  devServer: {
    port: 19997,
  },

  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: true,
    typedPages: true,
  },

  compatibilityDate: '2025-11-01',

  echarts: {
    renderer: ['canvas'],
    charts: ['LineChart'],
    components: [
      'DataZoomComponent',
      'GridComponent',
      'LegendComponent',
      'MarkPointComponent',
      'MarkLineComponent',
      'TitleComponent',
      'TooltipComponent',
    ],
  },

  eslint: {
    config: {
      standalone: false,
      nuxt: {
        sortConfigKeys: true,
      },
    },
  },

  pwa,
})

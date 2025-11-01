import type { InternalAxiosRequestConfig } from 'axios'

/**
 * 请求拦截器
 * @description 在每个请求发送前，自动附加认证 Token
 */
export function requestInterceptor(config: InternalAxiosRequestConfig) {
  // // getToken() 会被 Nuxt 自动导入
  // const token = getToken()

  // // 如果存在 token，则附加到请求头
  // if (token && config.headers)
  //   config.headers.set('Authorization', `Bearer ${token}`)

  return config
}

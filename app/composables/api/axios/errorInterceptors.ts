/**
 * 错误拦截器
 * @description 捕获网络层面的错误，如请求超时、网络中断等
 */
export function errorInterceptor(error: any) {
  return Promise.reject(error)
}

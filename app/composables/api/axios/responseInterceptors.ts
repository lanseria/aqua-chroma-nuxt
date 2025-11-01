import type { AxiosResponse } from 'axios'
import { Message } from '@arco-design/web-vue'

/**
 * 响应拦截器
 * @description 统一处理响应数据和各种 HTTP 错误
 */
export function responseInterceptor(response: AxiosResponse) {
  const { data, status } = response
  // 2. 处理业务请求成功 (HTTP 状态码 200)
  if (status === 200) {
    // 后端业务码成功 (code: 200)
    // --- 修改点 ---
    if (data.code === 200) {
      return data // 直接返回 { code, msg, data } 整个对象
    }
    // 后端业务码失败 (code: 非 200)
    else {
      Message.error(data.msg || '操作失败')
      return Promise.reject(new Error(data.msg || '操作失败'))
    }
  }

  // 3. 处理其他所有 HTTP 错误 (如 404, 500, 503 等)
  const errorMessage = data?.msg || `请求错误，状态码：${status}`
  Message.error(errorMessage)
  return Promise.reject(new Error(errorMessage))
}

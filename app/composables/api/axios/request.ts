import type { AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { errorInterceptor } from './errorInterceptors'
import { requestInterceptor } from './requestInterceptors'
import { responseInterceptor } from './responseInterceptors'

export const BASE_URL = import.meta.env.DEV ? '/api' : 'https://aqua-chroma.sharee.top'

const baseURL = BASE_URL

const commonConfig: AxiosRequestConfig = {
  baseURL,
  validateStatus: (status: number) => {
    return status >= 200 && status <= 600 // 全部允许, 不会遇到错误就停止
  },
}

export const request = axios.create(commonConfig)

request.interceptors.request.use(requestInterceptor, errorInterceptor)
request.interceptors.response.use(responseInterceptor, errorInterceptor)

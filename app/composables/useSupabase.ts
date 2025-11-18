import { createClient } from '@supabase/supabase-js'

/**
 * Nuxt Composable, 用于获取 Supabase 客户端实例。
 * 它会从 runtimeConfig 中读取 URL 和 Key, 确保凭证安全。
 */
export function useSupabase() {
  const config = useRuntimeConfig()

  const supabaseUrl = config.public.supabaseUrl
  const supabaseKey = config.public.supabaseKey

  if (!supabaseUrl || !supabaseKey)
    throw new Error('Supabase URL or Key is not defined in runtime config.')

  return createClient(supabaseUrl, supabaseKey)
}

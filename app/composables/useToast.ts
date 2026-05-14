import { ref } from 'vue'

export interface ToastItem {
  id: number
  type: 'success' | 'error' | 'warning' | 'info' | 'loading'
  message: string
}

const toasts = ref<ToastItem[]>([])
let nextId = 0

function addToast(type: ToastItem['type'], message: string, duration = 3000) {
  const id = nextId++
  toasts.value.push({ id, type, message })
  if (type !== 'loading' && duration > 0) {
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }
  return id
}

function removeToast(id: number) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx !== -1)
    toasts.value.splice(idx, 1)
}

export function useToast() {
  return {
    toasts,
    success: (msg: string, duration?: number) => addToast('success', msg, duration),
    error: (msg: string, duration?: number) => addToast('error', msg, duration),
    warning: (msg: string, duration?: number) => addToast('warning', msg, duration),
    info: (msg: string, duration?: number) => addToast('info', msg, duration),
    loading: (msg: string) => addToast('loading', msg, 0),
    remove: removeToast,
  }
}

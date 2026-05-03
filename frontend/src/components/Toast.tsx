import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let toastId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId
    setToasts(prev => {
      const newToasts = [...prev, { id, message, type }]
      return newToasts.slice(-5) // Keep only the last 5 toasts
    })
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'error':
        return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      case 'info':
      default:
        return 'bg-blue-500/20 border-blue-500/50 text-blue-400'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`border rounded-lg px-4 py-3 shadow-lg animate-fade-in ${getToastStyles(toast.type)}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

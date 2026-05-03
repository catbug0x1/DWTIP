import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react'
import { useToast } from '../components/Toast'
import { useQueryClient } from '@tanstack/react-query'

interface WebSocketMessage {
  type: 'new_leak' | 'new_alert' | 'scrape_update' | 'system'
  data: any
}

interface WebSocketContextType {
  isConnected: boolean
  lastMessage: WebSocketMessage | null
  sendMessage: (message: string) => void
}

const WebSocketContext = createContext<WebSocketContextType>({
  isConnected: false,
  lastMessage: null,
  sendMessage: () => {},
})

export function useWebSocket() {
  return useContext(WebSocketContext)
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastToastTimeRef = useRef<Record<string, number>>({})
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const throttleToast = useCallback((message: string, type: string, key: string) => {
    const now = Date.now()
    const lastTime = lastToastTimeRef.current[key] || 0
    if (now - lastTime > 5000) { // 5 seconds throttle
      showToast(message, type as any)
      lastToastTimeRef.current[key] = now
    }
  }, [showToast])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.CONNECTING || wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    console.log('Connecting to WebSocket:', wsUrl)
    const socket = new WebSocket(wsUrl)
    wsRef.current = socket

    socket.onopen = () => {
      setIsConnected(true)
      console.log('WebSocket connected')
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }

    socket.onclose = () => {
      setIsConnected(false)
      wsRef.current = null
      setWs(null)
      console.log('WebSocket disconnected')
      
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null
          connect()
        }, 5000)
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        setLastMessage(message)

        switch (message.type) {
          case 'new_leak':
            queryClient.invalidateQueries({ queryKey: ['leaks'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            throttleToast(`New leak detected: ${message.data.title}`, 'info', 'leak')
            break
          case 'new_alert':
            queryClient.invalidateQueries({ queryKey: ['alerts'] })
            throttleToast(`New alert: ${message.data.title}`, 'warning', 'alert')
            break
          case 'scrape_update':
            queryClient.invalidateQueries({ queryKey: ['leaks'] })
            queryClient.invalidateQueries({ queryKey: ['iocs'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
            break
          case 'system':
            if (message.data.message) {
              showToast(message.data.message, 'info')
            }
            break
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    // setWs(socket) - removed state to prevent unnecessary re-renders
  }, [queryClient, showToast, throttleToast])

  useEffect(() => {
    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])

  const sendMessage = useCallback((message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message)
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  )
}

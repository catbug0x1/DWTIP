import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
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
  const [ws, setWs] = useState<WebSocket | null>(null)
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      setIsConnected(true)
      console.log('WebSocket connected')
    }

    socket.onclose = () => {
      setIsConnected(false)
      console.log('WebSocket disconnected')
      setTimeout(connect, 5000)
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
            showToast(`New leak detected: ${message.data.title}`, 'info')
            break
          case 'new_alert':
            queryClient.invalidateQueries({ queryKey: ['alerts'] })
            showToast(`New alert: ${message.data.title}`, 'warning')
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

    setWs(socket)
  }, [queryClient, showToast])

  useEffect(() => {
    connect()

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [connect, ws])

  const sendMessage = useCallback((message: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message)
    }
  }, [ws])

  return (
    <WebSocketContext.Provider value={{ isConnected, lastMessage, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  )
}

import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useState, useEffect, useRef, useCallback } from 'react'

interface UseSSEReturn<T = unknown> {
  data: T | null
  isLoading: boolean
  error: Error | null
  sseIndex: number | null
  connect: () => Promise<void>
  close: () => void
}

const FINISHED_TYPE = 'text_end'

interface UseSSEOptions extends RequestInit {
  autoConnect?: boolean
  onStart?: (index: number) => void
  onFinish?: (finalData: unknown, index: number, variableName: string | null) => void
  maxRetries?: number
  retryDelay?: number
}

type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'closed'

const useSSE = <T = unknown>(
  url: string,
  options: UseSSEOptions = {},
): UseSSEReturn<T> => {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [sseIndex, setSseIndex] = useState<number | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const connectionStateRef = useRef<ConnectionState>('disconnected')
  const currentIndexRef = useRef(-1)
  const finalDataRef = useRef<string>('')
  const retryCountRef = useRef(0)

  const { autoConnect = true, maxRetries = 3, retryDelay = 1000 } = options

  const isActive = () =>
    mountedRef.current && connectionStateRef.current !== 'closed'

  const connectInternal = useCallback(async () => {
    if (
      connectionStateRef.current === 'connecting' ||
      connectionStateRef.current === 'connected' ||
      !isActive()
    ) {
      return
    }

    try {
      connectionStateRef.current = 'connecting'
      setIsLoading(true)
      setError(null)

      const newIndex = ++currentIndexRef.current
      setSseIndex(newIndex)
      finalDataRef.current = ''

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      await fetchEventSource(url, {
        ...options,
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          ...Object.entries(options.headers || {}).reduce(
            (acc, [key, value]) => {
              acc[key] = String(value)
              return acc
            },
            {} as Record<string, string>,
          ),
        },
        signal: abortController.signal,
        openWhenHidden: true,
        onopen: async () => {
          if (isActive()) {
            connectionStateRef.current = 'connected'
            setIsLoading(false)
            setError(null)
            retryCountRef.current = 0
            options.onStart?.(newIndex)
          }
        },
        onmessage: event => {
          if (isActive()) {
            try {
              // Parse JSON message
              const messageData = JSON.parse(event.data)

              // Check if this is the finish message
              if (messageData.type === FINISHED_TYPE) {
                options.onFinish?.(finalDataRef.current, newIndex, null)
                connectionStateRef.current = 'closed'
                retryCountRef.current = 0
                if (abortControllerRef.current) {
                  abortControllerRef.current.abort()
                  abortControllerRef.current = null
                }
                if (mountedRef.current) {
                  setIsLoading(false)
                }
                return
              }

              // Extract content from message
              const content = messageData.data.mdflow || ''

              if (content) {
                finalDataRef.current += content
                // Pass both content and variable info for interaction messages
                if (messageData.type === 'interaction' && messageData.data.variable) {
                  setData({
                    content: finalDataRef.current,
                    variableName: messageData.data.variable,
                  } as T)
                } else {
                  setData(finalDataRef.current as T)
                }
              }
            } catch (err) {
              if (process.env.NODE_ENV === 'development') {
                // eslint-disable-next-line no-console
                console.warn('Failed to process SSE message:', err, event.data)
              }
              // Fallback for non-JSON messages
              finalDataRef.current += event.data
              setData(finalDataRef.current as T)
            }
          }
        },
        onclose: () => {
          if (isActive()) {
            connectionStateRef.current = 'disconnected'
            setIsLoading(false)
          }
        },
        onerror: err => {
          if (isActive()) {
            connectionStateRef.current = 'error'
            setError(err)
            setIsLoading(false)
            if (retryCountRef.current < maxRetries && isActive()) {
              retryCountRef.current++
              setTimeout(() => {
                if (isActive()) {
                  connectInternal()
                }
              }, retryDelay)
            }
          }
          throw err
        },
      })
    } catch (err) {
      if (isActive()) {
        connectionStateRef.current = 'error'
        setError(err as Error)
        setIsLoading(false)
        if (retryCountRef.current < maxRetries && isActive()) {
          retryCountRef.current++
          setTimeout(() => {
            if (isActive()) {
              connectInternal()
            }
          }, retryDelay)
        }
      }
    }
  }, [url, options, maxRetries, retryDelay])

  const closeInternal = useCallback(() => {
    connectionStateRef.current = 'closed'
    retryCountRef.current = 0

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    if (mountedRef.current) {
      setIsLoading(false)
    }
  }, [])


  const connect = connectInternal
  const close = closeInternal

  useEffect(() => {
    mountedRef.current = true
    connectionStateRef.current = 'disconnected'
    retryCountRef.current = 0

    if (autoConnect) {
      const timeoutId = setTimeout(() => {
        if (connectionStateRef.current === 'disconnected') {
          connect()
        }
      }, 100)

      return () => {
        mountedRef.current = false
        clearTimeout(timeoutId)
        close()
      }
    } else {
      return () => {
        mountedRef.current = false
        close()
      }
    }
  }, [connect, close, autoConnect])

  // 监听 url 和 options 变化以重新连接
  useEffect(() => {
    if (connectionStateRef.current !== 'disconnected') {
      close()
      setData(null)
      setError(null)
      finalDataRef.current = ''
      connectionStateRef.current = 'disconnected'
      retryCountRef.current = 0

      const timeoutId = setTimeout(() => {
        if (connectionStateRef.current === 'disconnected' && isActive()) {
          connect()
        }
      }, 100)

      return () => {
        clearTimeout(timeoutId)
      }
    }
  }, [url, options, connect, close])

  return {
    data,
    isLoading,
    error,
    sseIndex,
    connect,
    close,
  }
}

export default useSSE

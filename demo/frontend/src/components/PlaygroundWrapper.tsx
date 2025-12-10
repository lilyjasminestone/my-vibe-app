'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'

import { API_BASE_URL } from '@/lib/api'

import Playground from './playground/Playground'

// Define markdown info data structure to match the API response
interface MarkdownInfoData {
  block_count: number;
  variables: string[];
  interaction_blocks: number[];
  content_blocks: number[];
}

interface PlaygroundWrapperProps {
  defaultContent: string
  defaultVariables?: Record<string, string | number | boolean>
  defaultDocumentPrompt?: string
  sseUrl?: string
  onRun?: () => void
  timestamp?: Date
  isRunning?: boolean
  sessionId?: string
  onVariableUpdate?: (variableName: string, value: string, rawValues?: string[]) => void
  markdownInfo?: MarkdownInfoData | null // Accept pre-analyzed markdown info from parent
}

const PlaygroundWrapper: React.FC<PlaygroundWrapperProps> = ({
  defaultContent,
  defaultVariables = {},
  defaultDocumentPrompt = '',
  sseUrl = `${API_BASE_URL}/playground/generate`,
  timestamp,
  isRunning = false,
  sessionId,
  onVariableUpdate,
  markdownInfo,
}) => {
  // Used to track the current running configuration
  const [currentConfig, setCurrentConfig] = useState(() => ({
    defaultContent,
    defaultVariables,
    defaultDocumentPrompt,
    sseUrl,
    sessionId,
  }))

  // Store playground content for copying
  const [playgroundContent, setPlaygroundContent] = useState<string[]>([])

  // Handle content updates from playground
  const handleContentUpdate = useCallback((content: string[]) => {
    setPlaygroundContent(content)
  }, [])

  // Used to track the previous sessionId to determine if re-run is needed
  const lastSessionIdRef = useRef<string | undefined>(sessionId)

  // When a new run starts (sessionId changes), update configuration
  useEffect(() => {
    if (sessionId && sessionId !== lastSessionIdRef.current) {
      setCurrentConfig({
        defaultContent,
        defaultVariables,
        defaultDocumentPrompt,
        sseUrl,
        sessionId,
      })
      // Clear previous content when starting new session
      setPlaygroundContent([])
      lastSessionIdRef.current = sessionId
    } else if (!sessionId && lastSessionIdRef.current) {
      // When sessionId is cleared, reset configuration
      setCurrentConfig({
        defaultContent: '',
        defaultVariables,
        defaultDocumentPrompt: '',
        sseUrl,
        sessionId: undefined,
      })
      setPlaygroundContent([])
      lastSessionIdRef.current = undefined
    }
  }, [sessionId, defaultContent, defaultVariables, defaultDocumentPrompt, sseUrl])

  return (
    <div className="border rounded-lg bg-white shadow-sm"> {/* Original ResultCard container styles */}
      {/* Execution info display */}
      {timestamp ? <div className="px-3 py-2 border-b bg-gray-50">
        <div className="grid grid-cols-2 items-center text-xs text-muted-foreground">
          <span>{timestamp.toLocaleString()}</span>
          {sessionId ? <div className="flex items-center gap-1 justify-end">
            <span>session: {sessionId}</span>
            <button
              onClick={() => {
                if (playgroundContent.length > 0) {
                  const fullContent = playgroundContent.join('\n\n')
                  navigator.clipboard.writeText(fullContent)
                  toast.success('内容已复制')
                } else {
                  navigator.clipboard.writeText(sessionId)
                  toast.success('会话 ID 已复制')
                }
              }}
              className="ml-1 p-1 rounded hover:bg-gray-200 transition-colors"
              title={playgroundContent.length > 0 ? '复制内容' : '复制会话 ID'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="m5 15-2 0a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div> : <div />}
        </div>
      </div> : null}

      {/* Loading status display */}
      {isRunning ? <div className="px-3 py-2 border-b bg-blue-50">
        <span className="text-xs text-blue-600 flex items-center gap-1">
          <div className="w-3 h-3 border border-blue-300 border-t-blue-600 rounded-full animate-spin" />
          运行中...
        </span>
      </div> : null}

      {/* Playground component */}
      <div className="p-3">
        {!isRunning && currentConfig.sessionId ? <Playground
          key={currentConfig.sessionId}
          defaultContent={currentConfig.defaultContent}
          defaultVariables={currentConfig.defaultVariables}
          defaultDocumentPrompt={currentConfig.defaultDocumentPrompt}
          sseUrl={currentConfig.sseUrl}
          sessionId={currentConfig.sessionId}
          styles={{
            minHeight: '400px',
            height: 'auto',
          }}
          onVariableUpdate={onVariableUpdate}
          onContentUpdate={handleContentUpdate}
          markdownInfo={markdownInfo} // Pass pre-analyzed markdown info to avoid duplicate API calls
        /> : null}
        {isRunning ? <div className="flex items-center justify-center h-96 text-muted-foreground">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
            <p>准备中...</p>
          </div>
        </div> : null}
        {!isRunning && !currentConfig.sessionId && (
          <div className="flex items-center justify-center h-96 text-muted-foreground">
            点击运行按钮开始
          </div>
        )}
      </div>
    </div>
  )
}

export default PlaygroundWrapper

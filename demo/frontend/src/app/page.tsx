'use client'

// Disable static generation for this page
export const dynamic = 'force-dynamic'

import { BarChart3, BookText, Eye, Plus } from 'lucide-react'
import Image from 'next/image'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, Toaster } from 'sonner'

import { EditPanel } from '@/components/EditPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { VariableColumn } from '@/components/VariableColumn'
import { ApiError, getMarkdownFlowInfo, type MarkdownFlowInfoResponse } from '@/lib/api'
import { getFallbackOptions, hasKnownIssues, logBrowserInfo } from '@/lib/browserCompat'

interface ConfigState {
  markdownFlow: string
  additionalPrompt: string
}

interface VariableGroup {
  id: string
  name: string
  variableValues: Record<string, string> // Store all variable values (display strings)
  variableArrays: Record<string, string[]> // Store multi-select arrays
  // Directly store current playground data
  currentPlaygroundData?: {
    content: string
    variables: Record<string, string>
    documentPrompt?: string
    timestamp: Date
    sessionId: string
  }
  isRunning?: boolean
}


interface DocumentAnalysis {
  isLoading: boolean
  data: MarkdownFlowInfoResponse['data'] | null
  error: string | null
}


export default function MarkdownFlowPlayground() {
  const [isDocOpen, setIsDocOpen] = useState(false)
  const [leftPanelWidth, setLeftPanelWidth] = useState(50) // Left panel width percentage
  const [documentAnalysis, setDocumentAnalysis] = useState<DocumentAnalysis>({
    isLoading: false,
    data: null,
    error: null,
  })

  // Load saved content from localStorage
  const loadSavedContent = (): { config: ConfigState; hasStoredContent: boolean } => {
    try {
      const saved = localStorage.getItem('markdownflow-playground-config')
      if (saved) {
        const parsedConfig = JSON.parse(saved) as ConfigState
        return {
          config: {
            markdownFlow: parsedConfig.markdownFlow || '',
            additionalPrompt: parsedConfig.additionalPrompt || '',
          },
          hasStoredContent: true,
        }
      }
    } catch (_error) {
      // Failed to load saved config from localStorage
    }
    // Return empty content on first visit
    return {
      config: {
        markdownFlow: '',
        additionalPrompt: '',
      },
      hasStoredContent: false,
    }
  }

  // Save content to localStorage
  const saveContent = useCallback((config: ConfigState) => {
    try {
      localStorage.setItem('markdownflow-playground-config', JSON.stringify(config))
    } catch (_error) {
      // Failed to save config to localStorage
    }
  }, [])

  // Avoid hydration mismatch, use safe default values for first render
  const [config, setConfig] = useState<ConfigState>({
    markdownFlow: '',
    additionalPrompt: '',
  })

  // Mark whether client initialization is complete
  const [isClientInitialized, setIsClientInitialized] = useState(false)

  // Mark whether user has made edits
  const [hasUserEdited, setHasUserEdited] = useState(false)

  // Mark whether current content is synced with analysis result
  const [isContentSynced, setIsContentSynced] = useState(true)


  // Load saved content from localStorage during client initialization (if any)
  useEffect(() => {
    const { config: savedConfig } = loadSavedContent()
    setConfig(savedConfig)

    // If non-empty content is loaded from localStorage, mark as needing analysis
    const hasContent = savedConfig.markdownFlow.trim() || savedConfig.additionalPrompt.trim()
    if (hasContent) {
      setHasUserEdited(false) // Initial load is not considered user editing
      setIsContentSynced(false) // Loaded content needs analysis
    }

    // Check browser compatibility
    logBrowserInfo()

    if (hasKnownIssues()) {
      const fallbackOptions = getFallbackOptions()
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.warn('⚠️ Browser compatibility issues detected, using fallbacks:', fallbackOptions)
      }
      // Show user-friendly warning for known issues
      toast.error('检测到浏览器兼容性问题', {
        duration: 8000,
      })
    }

    setIsClientInitialized(true)
  }, [])

  // Set browser title
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.title = 'MarkdownFlow 体验台'
    }
  }, [])

  // Handle user edit actions
  const handleUserEdit = useCallback(() => {
    setHasUserEdited(true)
    setIsContentSynced(false) // Mark content as not synced with analysis result
    // No longer clear documentAnalysis.data - keep results visible
  }, [])

  // Auto-save to localStorage when config changes (but skip initial load)
  useEffect(() => {
    if (isClientInitialized) {
      saveContent(config)
    }
  }, [config, saveContent, isClientInitialized])

  // Variable list obtained from backend API
  const extractedVariables = useMemo(() => {
    return documentAnalysis.data?.variables || []
  }, [documentAnalysis.data?.variables])

  // Variable group management
  const [variableGroups, setVariableGroups] = useState<VariableGroup[]>([
    {
      id: '1',
      name: '对比 1',
      variableValues: {}, // Initialize empty values
      variableArrays: {}, // Initialize empty arrays
    },
  ])

  // Remove groupResults and runningStates, state is now stored directly in variableGroups


  const handleRun = async (groupId: string) => {
    // 1. Set running state
    setVariableGroups(prev => prev.map(group =>
      group.id === groupId
        ? { ...group, isRunning: true }
        : group,
    ))

    const group = variableGroups.find((g) => g.id === groupId)
    if (!group) {
      setVariableGroups(prev => prev.map(g =>
        g.id === groupId
          ? { ...g, isRunning: false }
          : g,
      ))
      return
    }

    // 2. Get current input values from refs
    const currentParameters = getGroupParameters(group)

    // 3. Generate concise format sessionId: pg-date-hexcode
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD

    let hexCode: string
    try {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const randomBytes = crypto.getRandomValues(new Uint8Array(4))
        hexCode = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('')
      } else {
        throw new Error('Crypto API not available')
      }
    } catch (_error) {
      // Fallback to Math.random for compatibility
      hexCode = Math.random().toString(16).substring(2, 10).padEnd(8, '0')
    }

    const sessionId = `pg-${dateStr}-${hexCode}`

    // 4. Directly update the variable group's playground data (replace, not append)
    setVariableGroups(prev => prev.map(g =>
      g.id === groupId
        ? {
          ...g,
          currentPlaygroundData: {
            content: config.markdownFlow,
            variables: currentParameters,
            documentPrompt: config.additionalPrompt,
            timestamp: new Date(),
            sessionId: sessionId,
          },
          isRunning: false,
        }
        : g,
    ))
  }


  const handleRunAll = () => {
    variableGroups.forEach((group) => {
      handleRun(group.id)
    })
  }







  const handleDocumentAnalysis = async () => {
    if (!config.markdownFlow.trim() && !config.additionalPrompt.trim()) {
      toast.error('请先输入内容或文档提示词')
      return null
    }

    setDocumentAnalysis({ isLoading: true, data: null, error: null })

    try {
      const response = await getMarkdownFlowInfo({
        content: config.markdownFlow,
        document_prompt: config.additionalPrompt || undefined,
      })

      setDocumentAnalysis({
        isLoading: false,
        data: response.data,
        error: null,
      })

      // After successful document analysis, reset edit status to allow running
      setHasUserEdited(false)

      // Show success toast with analysis summary
      const variableCount = response.data.variables?.length || 0
      const blockCount = response.data.block_count || 0
      toast.success(`文档解析成功！检测到 ${variableCount} 个变量，共 ${blockCount} 个块`)

      return response.data // Return the analysis data for synchronous processing

    } catch (error) {

      let errorMessage = '文档解析失败'

      if (error instanceof ApiError) {
        errorMessage = error.message
      } else if (error instanceof Error) {
        errorMessage = error.message
      }

      setDocumentAnalysis({
        isLoading: false,
        data: null,
        error: errorMessage,
      })

      // Show error toast
      toast.error(errorMessage)
      return null // Return null on failure
    }
  }

  // Synchronously update variable groups with new variables while preserving values
  const updateVariableGroupsWithNewVariables = useCallback(
    (newVariables: string[], savedValues: Record<string, Record<string, string>>) => {
      setVariableGroups((prev) =>
        prev.map((group) => {
          // Use saved values for this group, filter to only include variables that still exist
          const filteredValues: Record<string, string> = {}
          const groupSavedValues = savedValues[group.id] || {}
          newVariables.forEach((variable) => {
            if (groupSavedValues[variable] !== undefined) {
              filteredValues[variable] = groupSavedValues[variable]
            }
          })

          return {
            ...group,
            variableValues: filteredValues,
          }
        }),
      )
    },
    [],
  )

  // Function to save all current variable values before analysis
  const saveAllVariableValues = useCallback((): Record<string, Record<string, string>> => {
    const allValues: Record<string, Record<string, string>> = {}

    variableGroups.forEach((group) => {
      // Directly use variableValues since we're now using controlled components
      allValues[group.id] = { ...group.variableValues }
    })

    return allValues
  }, [variableGroups])


  // Unified transform function that handles both analysis and running
  const handleTransform = async () => {
    // Step 1: Check if analysis is needed based on content sync status
    if (!isContentSynced) {
      // Save all current variable values before analysis
      const savedValues = saveAllVariableValues()

      // Perform document analysis
      const analysisData = await handleDocumentAnalysis()
      if (!analysisData) {
        return // Exit if analysis failed
      }

      // Synchronously update variable groups with new variables while preserving values
      const newVariables = analysisData.variables || []
      updateVariableGroupsWithNewVariables(newVariables, savedValues)

      setIsContentSynced(true) // Mark content as synced after successful analysis

      // Small delay to ensure DOM is updated with new values
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Step 2: Execute transformation
    // At this point, we either just analyzed or already have synced analysis data
    // So we can directly run all variable groups
    handleRunAll()
  }

  const addVariableGroup = useCallback(() => {
    const newGroup: VariableGroup = {
      id: Date.now().toString(),
      name: `对比 ${variableGroups.length + 1}`,
      variableValues: {}, // Initialize empty values for new group
      variableArrays: {}, // Initialize empty arrays for new group
    }

    setVariableGroups((prev) => [...prev, newGroup])
  }, [variableGroups.length, extractedVariables])

  const removeVariableGroup = useCallback(
    (groupId: string) => {
      if (variableGroups.length <= 1) {
        return
      }
      setVariableGroups((prev) => prev.filter((group) => group.id !== groupId))
    },
    [variableGroups.length],
  )

  // Get current values from variableValues
  const getGroupParameters = useCallback((group: VariableGroup): Record<string, string> => {
    return { ...group.variableValues }
  }, [])

  // 处理变量更新的回调函数
  const handleVariableUpdate = useCallback((
    groupId: string,
    variableName: string,
    value: string,
    rawValues?: string[],
  ) => {
    setVariableGroups(prevGroups => {
      return prevGroups.map((group) => {
        if (group.id === groupId) {
          // 直接更新变量值
          const updatedVariableValues = {
            ...group.variableValues,
            [variableName]: value,
          }

          // 如果有 rawValues，同时更新数组值
          const updatedVariableArrays = rawValues ? {
            ...group.variableArrays,
            [variableName]: rawValues,
          } : {
            ...group.variableArrays,
          }

          return {
            ...group,
            variableValues: updatedVariableValues,
            variableArrays: updatedVariableArrays,
          }
        }
        return group
      })
    })
  }, [])

  // Drag handling function
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()

    const startX = e.clientX
    const startWidth = leftPanelWidth

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX
      const containerWidth = window.innerWidth
      const deltaPercent = (deltaX / containerWidth) * 100
      const newWidth = Math.max(20, Math.min(80, startWidth + deltaPercent)) // 限制在20%-80%之间
      setLeftPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [leftPanelWidth])


  // ResultCard has been removed, functionality merged into PlaygroundWrapper

  return (
    <div className="flex flex-col h-full bg-background">
      <Toaster position="top-center" richColors />
      <header className="border-b bg-background flex-shrink-0">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center space-x-2">
            <a
              href="https://markdownflow.ai"
              target="_blank"
              rel="noopener"
              className="group hover:scale-105 transition-transform duration-200"
            >
              <Image
                src="/logo-outter-solid.svg"
                alt="Logo"
                width={32}
                height={20}
                className="h-6 w-8 group-hover:hidden"
              />
              <Image
                src="/logo-color.svg"
                alt="Logo"
                width={32}
                height={20}
                className="h-6 w-8 hidden group-hover:block"
              />
            </a>
            <h1 className="text-xl font-semibold">MarkdownFlow 体验台</h1>

          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Edit Panel - Configuration */}
        <div style={{ width: `${leftPanelWidth}%` }} className="overflow-y-auto h-full">
          <EditPanel
            config={config}
            documentAnalysis={documentAnalysis}
            onConfigChange={setConfig}
            onUserEdit={handleUserEdit}
            onDocumentAnalysis={handleTransform}
          />
        </div>

        {/* Resize Handle */}
        <div
          className="w-1 bg-border cursor-col-resize hover:bg-gray-400 transition-colors"
          onMouseDown={handleMouseDown}
        />

        {/* Right Panel - Variables & Results */}
        <div
          className="flex flex-col p-6 overflow-y-auto h-full"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline flex-wrap title-subtitle-container">
              <Eye className="h-5 w-5 self-center" />
              <h2 className="section-title-main">
                预览区
              </h2>
              <span className="section-subtitle break-words">每人每次，效果不同</span>
            </div>
            {documentAnalysis.data ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDocOpen(true)}
                  disabled={!documentAnalysis.data}
                  title={!documentAnalysis.data ? '请先完成文档解析' : ''}
                >
                  <BookText className="h-4 w-4 mr-2" />
                  文档信息
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addVariableGroup}
                  disabled={!documentAnalysis.data || variableGroups.length >= 4}
                  title={
                    !documentAnalysis.data
                      ? '请先在左侧完成文档解析'
                      : variableGroups.length >= 4
                        ? '最多只能同时有四个对比'
                        : ''
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加对比
                  {variableGroups.length >= 4
                    ? ' (已达上限)'
                    : variableGroups.length > 1
                      ? ` (${variableGroups.length}/4)`
                      : ''}
                </Button>
              </div>
            ) : null}
          </div>

          {documentAnalysis.data ? (
            <div>
              {/* Content sync status notification */}
              {!isContentSynced && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                    <span className="text-yellow-700 text-sm font-medium">
                      内容已修改
                    </span>
                  </div>
                  <p className="text-yellow-600 text-xs mt-1 ml-4">
                    点击左侧&ldquo;预览&rdquo;按钮重新分析文档后再生成内容
                  </p>
                </div>
              )}

              <div
                className={`grid gap-4 ${variableGroups.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}
              >
                {variableGroups.map((group, index) => (
                  <VariableColumn
                    key={index}
                    group={group}
                    extractedVariables={extractedVariables}
                    canRemove={variableGroups.length > 1}
                    onRemove={removeVariableGroup}
                    onVariableUpdate={handleVariableUpdate}
                    documentAnalysis={documentAnalysis.data} // Pass document analysis data to avoid duplicate API calls
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm">请在左侧输入内容，然后点击&ldquo;预览&rdquo;按钮开始</p>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Document dialog */}
      <Dialog open={isDocOpen} onOpenChange={setIsDocOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              文档解析结果
            </DialogTitle>
            <DialogDescription>查看 MarkdownFlow 文档的解析统计信息</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] w-full">
            <div className="space-y-6 p-4">
              {documentAnalysis.data ? (
                <div className="space-y-4">
                  {/* Basic statistics */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded border text-center shadow-sm">
                      <div className="text-3xl font-bold text-blue-600">{documentAnalysis.data.block_count}</div>
                      <div className="text-sm text-muted-foreground mt-1">总块数</div>
                    </div>
                    <div className="bg-white p-4 rounded border text-center shadow-sm">
                      <div className="text-3xl font-bold text-green-600">{documentAnalysis.data.variables?.length || 0}</div>
                      <div className="text-sm text-muted-foreground mt-1">变量数</div>
                    </div>
                    <div className="bg-white p-4 rounded border text-center shadow-sm">
                      <div className="text-3xl font-bold text-orange-600">{documentAnalysis.data.interaction_blocks?.length || 0}</div>
                      <div className="text-sm text-muted-foreground mt-1">交互块</div>
                    </div>
                    <div className="bg-white p-4 rounded border text-center shadow-sm">
                      <div className="text-3xl font-bold text-purple-600">{documentAnalysis.data.content_blocks?.length || 0}</div>
                      <div className="text-sm text-muted-foreground mt-1">内容块</div>
                    </div>
                  </div>

                  {/* Variable list */}
                  {documentAnalysis.data.variables && documentAnalysis.data.variables.length > 0 ? (
                    <div className="bg-white p-4 rounded border shadow-sm">
                      <h4 className="font-semibold mb-3 text-lg">检测到的变量</h4>
                      <div className="flex flex-wrap gap-2">
                        {documentAnalysis.data.variables.map((variable, index) => (
                          <Badge key={index} variant="secondary" className="text-sm px-3 py-1">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Block index information */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {documentAnalysis.data.interaction_blocks && documentAnalysis.data.interaction_blocks.length > 0 ? (
                      <div className="bg-white p-4 rounded border shadow-sm">
                        <h4 className="font-semibold mb-2 text-orange-600 text-lg">交互块索引</h4>
                        <div className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                          {documentAnalysis.data.interaction_blocks.join(', ')}
                        </div>
                      </div>
                    ) : null}

                    {documentAnalysis.data.content_blocks && documentAnalysis.data.content_blocks.length > 0 ? (
                      <div className="bg-white p-4 rounded border shadow-sm">
                        <h4 className="font-semibold mb-2 text-purple-600 text-lg">内容块索引</h4>
                        <div className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded">
                          {documentAnalysis.data.content_blocks.join(', ')}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setIsDocOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

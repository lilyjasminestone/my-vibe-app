'use client'

import { BookOpen, Loader2, Sparkles } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

// Dynamic import to avoid SSR issues
const MarkdownFlowEditor = dynamic(
  () => import('markdown-flow-ui').then((mod) => mod.MarkdownFlowEditor),
  { ssr: false, loading: () => <div className="h-64 flex items-center justify-center">Loading editor...</div> }
)

import type { EditMode } from 'markdown-flow-ui'

import { DocumentPromptEditor } from '@/components/DocumentPromptEditor'
import { LearnMoreLink } from '@/components/LearnMoreLink'

import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface DocumentAnalysisData {
  block_count: number
  variables: string[]
  interaction_blocks: number[]
  content_blocks: number[]
}

interface DocumentAnalysis {
  isLoading: boolean
  data: DocumentAnalysisData | null
  error: string | null
}

interface ConfigState {
  markdownFlow: string
  additionalPrompt: string
}

interface EditPanelProps {
  config: ConfigState
  documentAnalysis: DocumentAnalysis
  onConfigChange: (config: ConfigState) => void
  onUserEdit: () => void
  onDocumentAnalysis: () => void
}

type VariableOption = {
  name: string
  label?: string
}

const VARIABLE_PATTERN = /{{\s*([^{}\s]+)\s*}}/g

const extractVariablesFromMarkdown = (content: string): string[] => {
  if (!content) {
    return []
  }

  const names = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = VARIABLE_PATTERN.exec(content)) !== null) {
    const variableName = match[1]?.trim()
    if (variableName) {
      names.add(variableName)
    }
  }

  return Array.from(names)
}

const mergeVariableNames = (markdownContent: string,
  additionalPrompt: string, analysisVariables?: string[] | null): string[] => {
  const orderedNames: string[] = []

  if (analysisVariables && analysisVariables.length > 0) {
    analysisVariables.forEach(name => {
      if (!orderedNames.includes(name)) {
        orderedNames.push(name)
      }
    })
  }

  const extracted = extractVariablesFromMarkdown(markdownContent)
  const additionalPromptVariables = extractVariablesFromMarkdown(additionalPrompt)
  extracted.forEach(name => {
    if (!orderedNames.includes(name)) {
      orderedNames.push(name)
    }
  })
  additionalPromptVariables.forEach(name => {
    if (!orderedNames.includes(name)) {
      orderedNames.push(name)
    }
  })
  return orderedNames
}

const mapVariableOptions = (names: string[]): VariableOption[] =>
  names.map(name => ({ name }))

const areVariableListsEqual = (prev: VariableOption[], nextNames: string[]): boolean => {
  if (prev.length !== nextNames.length) {
    return false
  }

  return prev.every((item, index) => item.name === nextNames[index])
}

export const EditPanel: React.FC<EditPanelProps> = ({
  config,
  documentAnalysis,
  onConfigChange,
  onUserEdit,
  onDocumentAnalysis,
}) => {
  // Check if transform operation can be performed
  const canPerform = !!(config.markdownFlow.trim() || config.additionalPrompt.trim())
  const [editMode, setEditMode] = useState<EditMode>('quickEdit' as EditMode)
  const editModeOptions = useMemo(
    () => [
      {
        label: '可视',
        value: 'quickEdit' as EditMode,
      },
      {
        label: '文本',
        value: 'codeEdit' as EditMode,
      },
    ],
    [],
  )

  const [variables, setVariables] = useState<VariableOption[]>(() =>
    mapVariableOptions(mergeVariableNames(config.markdownFlow,
      config.additionalPrompt, documentAnalysis.data?.variables)),
  )

  useEffect(() => {
    const mergedNames = mergeVariableNames(config.markdownFlow,
      config.additionalPrompt, documentAnalysis.data?.variables)

    setVariables(prev => {
      if (areVariableListsEqual(prev, mergedNames)) {
        return prev
      }
      return mapVariableOptions(mergedNames)
    })
  }, [config.markdownFlow, config.additionalPrompt, documentAnalysis.data?.variables])

  const handleContentChange = (value: string) => {
    onConfigChange({ ...config, markdownFlow: value })
    onUserEdit()
  }

  const handleDocumentPromptChange = (value: string) => {
    onConfigChange({ ...config, additionalPrompt: value })
    onUserEdit()
  }
  const memoizedVariables = useMemo(() => variables, [variables])

  return (
    <div className="flex flex-col p-6 border-r h-full">
      {/* Creation area: integrated directly into EditPanel */}
      <div className="mb-4 flex-shrink-0">
        {/* Creation area title and transform button */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-baseline flex-wrap title-subtitle-container">
            <BookOpen className="h-5 w-5 self-center" />
            <h2 className="section-title-main">创作区</h2>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Transform button */}
            <Button
              variant="default"
              size="sm"
              onClick={onDocumentAnalysis}
              disabled={documentAnalysis.isLoading || !canPerform}
              className="flex items-center gap-2"
            >
              {documentAnalysis.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {documentAnalysis.isLoading
                ? '预览中...'
                : '预览'
              }
            </Button>
          </div>
        </div>
      </div>

      {/* Edit areas */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Content prompt area - takes 70% height */}
        <div className="flex-[0.7]  min-h-0">
          <div className="h-full flex flex-col min-h-0">
            {/* Content prompt title */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-baseline flex-wrap title-subtitle-container">
                <h3 className="section-title-form">内容提示词</h3>
                <span className="section-subtitle break-words">
                  写清想要的细节。也可适当留白，让 AI 演绎
                  <LearnMoreLink
                    linkKey="contentPrompt"
                    className="inline-flex ml-1 transition-colors"
                    style={{ color: 'rgba(100, 116, 139, 0.7)' }}
                  />
                </span>
              </div>
              <Tabs
                value={editMode}
                onValueChange={value => setEditMode(value as EditMode)}
                className="ml-auto"
              >
                <TabsList className="h-8 rounded-full bg-muted/60 p-0 text-xs">
                  {editModeOptions.map(option => (
                    <TabsTrigger
                      key={option.value}
                      value={option.value}
                      className={cn(
                        'rounded-full px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground',
                      )}
                    >
                      {option.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Markdown editor */}
            <div className="flex-1 min-h-0">
              <MarkdownFlowEditor
                content={config.markdownFlow}
                onChange={handleContentChange}
                editMode={editMode}
                uploadProps={{
                  beforeUpload: () => {
                    toast.error('体验台暂不支持上传图片，请复制图片链接后使用')
                    return false
                  },
                }}
                locale="zh-CN"
                variables={memoizedVariables}
              />
            </div>
          </div>
        </div>

        {/* Document prompt area - takes 30% height */}
        <div className="flex-[0.3] min-h-0">
          <DocumentPromptEditor
            value={config.additionalPrompt}
            onChange={handleDocumentPromptChange}
            placeholder="输入额外的文档提示词（可选）"
            label="文档提示词"
            variables={memoizedVariables}
          />
        </div>
      </div>
    </div>
  )
}

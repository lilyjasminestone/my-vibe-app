'use client'

import dynamic from 'next/dynamic'
import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'

// Dynamic import to avoid SSR issues
const MarkdownFlowEditor = dynamic(
  () => import('markdown-flow-ui').then((mod) => mod.MarkdownFlowEditor),
  { ssr: false, loading: () => <div className="h-32 flex items-center justify-center text-sm text-gray-500">Loading editor...</div> }
)

import type { EditMode } from 'markdown-flow-ui'

import { LearnMoreLink } from '@/components/LearnMoreLink'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface VariableOption {
  name: string
  label?: string
}

interface DocumentPromptEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label?: string
  variables?: VariableOption[]
}

export const DocumentPromptEditor: React.FC<DocumentPromptEditorProps> = ({
  value,
  onChange,
  placeholder,
  label,
  variables,
}) => {
  const [viewMode, setViewMode] = useState<EditMode>('quickEdit' as EditMode)
  const viewModeOptions = useMemo(
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

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline flex-wrap title-subtitle-container">
          <h3 className="section-title-form">{label || '文档提示词'}</h3>
          <span className="section-subtitle break-words">
            对象，语气，风格，注意事项等整体约束
            <LearnMoreLink
              linkKey="documentPrompt"
              className="inline-flex ml-1 transition-colors"
              style={{ color: 'rgba(100, 116, 139, 0.7)' }}
            />
          </span>
        </div>
        <Tabs
          value={viewMode}
          onValueChange={value => setViewMode(value as EditMode)}
          className="ml-auto"
        >
          <TabsList className="h-8 rounded-full bg-muted/60 p-0 text-xs">
            {viewModeOptions.map(option => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="rounded-full px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground"
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 min-h-0">
        <MarkdownFlowEditor
          content={value}
          onChange={onChange}
          editMode={viewMode}
          uploadProps={{
            beforeUpload: () => {
              toast.error('体验台暂不支持上传图片，请复制图片链接后使用')
              return false
            },
          }}
          locale="zh-CN"
          variables={variables ?? []}
          placeholder={placeholder || '输入额外的文档提示词（可选）'}
        />
      </div>
    </div>
  )
}

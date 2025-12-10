'use client'

import React from 'react'

import { Textarea } from '@/components/ui/textarea'

interface MarkdownFlowEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const MarkdownFlowEditor: React.FC<MarkdownFlowEditorProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="h-full">
      <Textarea
        id="markdownflow"
        value={value}
        onChange={handleChange}
        className="text-sm resize-none h-full"
        placeholder={placeholder || '选择一个示例开始，或直接编写 MarkdownFlow 内容'}
        style={{ overflowY: 'auto', minHeight: 'unset', height: '100%' }}
      />
    </div>
  )
}

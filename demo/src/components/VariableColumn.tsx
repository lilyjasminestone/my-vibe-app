import { Trash2 } from 'lucide-react'
import React, { useMemo } from 'react'


import { LearnMoreLink } from '@/components/LearnMoreLink'
import PlaygroundWrapper from '@/components/PlaygroundWrapper'
import { Button } from '@/components/ui/button'
import { VariableInput } from '@/components/VariableInput'
import { API_BASE_URL } from '@/lib/api'

interface VariableGroup {
  id: string
  name: string
  variableValues: Record<string, string>
  variableArrays: Record<string, string[]>
  currentPlaygroundData?: {
    content: string
    variables: Record<string, string>
    documentPrompt?: string
    timestamp: Date
    sessionId: string
  }
  isRunning?: boolean
}

// Define document analysis data structure to match the API response
interface DocumentAnalysisData {
  block_count: number;
  variables: string[];
  interaction_blocks: number[];
  content_blocks: number[];
}

interface VariableColumnProps {
  group: VariableGroup
  extractedVariables: string[]
  canRemove: boolean
  onRemove: (groupId: string) => void
  onVariableUpdate?: (groupId: string, variableName: string, value: string, rawValues?: string[]) => void
  documentAnalysis?: DocumentAnalysisData | null // Accept document analysis data to avoid duplicate API calls
}

export const VariableColumn: React.FC<VariableColumnProps> = React.memo(function VariableColumn({
  group,
  extractedVariables,
  canRemove,
  onRemove,
  onVariableUpdate,
  documentAnalysis,
}) {
  // Calculate the maximum width needed for variable labels
  const maxLabelWidth = useMemo(() => {
    if (!extractedVariables || extractedVariables.length === 0) {
      return 128 // default 8rem (w-32)
    }

    // Calculate character width (approximately 8px per character for most fonts)
    const maxChars = Math.max(...extractedVariables.map(variable => `{{${variable}}}:`.length))
    // Add some padding and ensure minimum width, max width to prevent too wide labels
    const calculatedWidth = Math.min(Math.max(maxChars * 8 + 24, 128), 240)
    return calculatedWidth
  }, [extractedVariables])
  return (
    <div className="bg-gray-50/50 border rounded-lg flex flex-col">
      {/* Header & Inputs */}
      <div className="p-3 border-b">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-baseline flex-wrap title-subtitle-container">
            <h3 className="section-title-form">变量</h3>
            <span className="section-subtitle break-words">
              活用变量，让个性化更浓
              <LearnMoreLink
                linkKey="variables"
                className="inline-flex ml-1 transition-colors"
                style={{ color: 'rgba(100, 116, 139, 0.7)' }}
              />
            </span>
          </div>
          {canRemove ? <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(group.id)}
            className='text-red-600 hover:text-red-700 hover:bg-red-50 h-6 w-6 p-0'
          >
            <Trash2 className="h-3 w-3" />
          </Button> : null}
        </div>

        {/* Variable form - inline layout */}
        <div
          className="space-y-2"
          style={{ '--label-width': `${maxLabelWidth}px` } as React.CSSProperties}
        >
          {extractedVariables.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-3 px-1">
                基于变量值生成个性化的内容
              </div>
              {extractedVariables.map((variable) => (
                <VariableInput
                  key={`${group.id}-${variable}`}
                  groupId={group.id}
                  variable={variable}
                  value={group.variableValues[variable] || ''}
                  onChange={(value) => onVariableUpdate?.(group.id, variable, value)}
                />
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-3">
              未检测到变量
            </div>
          )}
        </div>

      </div>

      {/* Results */}
      <div className="p-4">
        <PlaygroundWrapper
          defaultContent={group.currentPlaygroundData?.content || ''}
          defaultVariables={{ ...group.currentPlaygroundData?.variables, ...{} }}
          defaultDocumentPrompt={group.currentPlaygroundData?.documentPrompt}
          timestamp={group.currentPlaygroundData?.timestamp}
          isRunning={group.isRunning}
          sessionId={group.currentPlaygroundData?.sessionId}
          sseUrl={`${API_BASE_URL}/playground/generate`}
          markdownInfo={documentAnalysis} // Pass pre-analyzed document data to avoid duplicate API calls
          onVariableUpdate={(variableName, value, rawValues) => {
            if (onVariableUpdate) {
              onVariableUpdate(group.id, variableName, value, rawValues)
            }
          }}
        />
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function: only re-render when group or canRemove actually change
  const groupEqual = prevProps.group === nextProps.group
  const canRemoveEqual = prevProps.canRemove === nextProps.canRemove
  const documentAnalysisEqual = prevProps.documentAnalysis === nextProps.documentAnalysis

  // Safely compare extractedVariables, handling null/undefined cases
  const prevVariables = prevProps.extractedVariables || []
  const nextVariables = nextProps.extractedVariables || []
  const variablesEqual =
    prevVariables.length === nextVariables.length &&
    prevVariables.every((v, i) => v === nextVariables[i])

  return groupEqual && canRemoveEqual && variablesEqual && documentAnalysisEqual
})

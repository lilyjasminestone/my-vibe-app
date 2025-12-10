import React from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface VariableInputProps {
  groupId: string
  variable: string
  value: string
  onChange: (value: string) => void
}

export const VariableInput: React.FC<VariableInputProps> = React.memo(function VariableInput({
  groupId,
  variable,
  value,
  onChange,
}) {
  return (
    <div className="flex items-center">
      <Label
        htmlFor={`${groupId}-${variable}`}
        className="text-xs font-medium text-muted-foreground flex-shrink-0 text-right pr-3 !flex !justify-end !items-center !gap-0"
        style={{ width: 'var(--label-width, 8rem)' }}
      >
        {`{{${variable}}}:`}
      </Label>
      <Input
        id={`${groupId}-${variable}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="UNKNOWN"
        className="bg-white h-8 text-sm flex-1"
      />
    </div>
  )
})

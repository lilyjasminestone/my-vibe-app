import { Check, Clipboard } from 'lucide-react'
import React, { useState } from 'react'

interface CopyButtonProps {
  content: string
}

const CopyButton: React.FC<CopyButtonProps> = ({ content }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!content) return

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
      {copied && (
        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded animate-fade-in">
          已复制!
        </span>
      )}
      <button
        onClick={handleCopy}
        className={`
          p-2 rounded-full transition-colors duration-200 shadow-sm
          ${copied 
            ? 'bg-green-100 text-green-600 hover:bg-green-200' 
            : 'bg-gray-500 text-white hover:bg-gray-600' // 使用您要求的灰色背景 #6b7280 (gray-500) 和悬停 #4b5563 (gray-600)
          }
        `}
        title="复制内容"
      >
        {copied ? (
          <Check className="w-4 h-4" />
        ) : (
          <Clipboard className="w-4 h-4" />
        )}
      </button>
    </div>
  )
}

export default CopyButton

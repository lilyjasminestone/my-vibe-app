'use client'

import { HelpCircle } from 'lucide-react'

interface LearnMoreLinkProps {
  linkKey: string
  className?: string
  style?: React.CSSProperties
}

const links: Record<string, string> = {
  contentPrompt: 'https://markdownflow.ai/docs/zh/specification/overview/',
  documentPrompt: 'https://markdownflow.ai/docs/zh/specification/how-it-works/#2',
  variables: 'https://markdownflow.ai/docs/zh/specification/variables/',
}

export function LearnMoreLink({ linkKey, className, style }: LearnMoreLinkProps) {
  const link = links[linkKey]

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener"
      className={className}
      style={style}
      title="了解更多"
    >
      <HelpCircle className="h-3.5 w-3.5" />
    </a>
  )
}

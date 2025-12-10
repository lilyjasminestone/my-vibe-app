import { useState, useEffect } from 'react'

import { API_BASE_URL } from '@/lib/api'

interface MarkdownInfoData {
  block_count: number;
  variables: string[];
  interaction_blocks: number[];
  content_blocks: number[];
}

interface MarkdownInfoResponse {
  code: number;
  message: string;
  data: MarkdownInfoData;
  trace: string;
}

const useMarkdownInfo = (content: string) => {
  const [data, setData] = useState<MarkdownInfoData | null>(null)
  const [loading, setLoading] = useState<boolean>(false) // Initialize as false to avoid unnecessary loading state
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Skip API call if content is empty or if we should avoid duplicate calls
    if (!content || !content.trim()) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }

    const fetchMarkdownInfo = async () => {
      try {
        setLoading(true)

        // Use Next.js built-in fetch
        const response = await fetch(`${API_BASE_URL}/playground/markdownflow_info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Output-Language': 'zh',
          },
          body: JSON.stringify({ content }),
          // Next.js fetch cache options
          cache: 'no-store',
          // Or use next: { revalidate: 0 } to disable cache
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const result: MarkdownInfoResponse = await response.json()

        if (result.code === 200) {
          setData(result.data)
        } else {
          setError(result.message || 'Request failed')
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Network error')
      } finally {
        setLoading(false)
      }
    }

    fetchMarkdownInfo()
  }, [content])

  return { data, loading, error }
}

export default useMarkdownInfo

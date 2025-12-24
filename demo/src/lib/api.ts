export const API_BASE_URL = (process.env.NEXT_PUBLIC_PLAYGROUND_URL || '') + '/api/v1'

/**
 * Get common request headers
 */
function getCommonHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
  }
}

export interface MarkdownFlowInfoRequest {
  content: string
  document_prompt?: string
}

export interface MarkdownFlowInfoResponse {
  code: number
  message: string
  data: {
    block_count: number
    variables: string[]
    interaction_blocks: number[]
    content_blocks: number[]
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: number,
    public response?: Response,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(
      `API request failed: ${response.status} ${response.statusText}`,
      response.status,
      response,
    )
  }

  const data = await response.json()

  if (data.code !== undefined && data.code !== 200) {
    throw new ApiError(data.message || 'API returned error code', data.code)
  }

  return data
}

export async function getMarkdownFlowInfo(
  request: MarkdownFlowInfoRequest,
): Promise<MarkdownFlowInfoResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}`, {
      method: 'POST',
      headers: getCommonHeaders(),
      body: JSON.stringify(request),
    })

    return await handleApiResponse<MarkdownFlowInfoResponse>(response)
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}
/**
 * Browser Compatibility Utilities
 * Handles browser-specific compatibility issues, especially for Windows 11/Edge
 */

export interface BrowserInfo {
  isEdge: boolean
  isWindows: boolean
  supportsEventSource: boolean
  supportsCrypto: boolean
  supportsLocalStorage: boolean
  version?: string
}

/**
 * Detect browser information and capabilities
 */
export function getBrowserInfo(): BrowserInfo {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''

  const isEdge = /Edg\//.test(userAgent)
  const isWindows = /Windows/.test(userAgent)

  // Check EventSource support
  const supportsEventSource = typeof EventSource !== 'undefined'

  // Check crypto API support
  const supportsCrypto = typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'

  // Check localStorage support
  const supportsLocalStorage = (() => {
    try {
      if (typeof Storage === 'undefined' || typeof localStorage === 'undefined') {
        return false
      }
      const testKey = '__test_localStorage__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  })()

  // Extract Edge version if available
  const edgeMatch = userAgent.match(/Edg\/(\d+)\./)
  const version = edgeMatch ? edgeMatch[1] : undefined

  return {
    isEdge,
    isWindows,
    supportsEventSource,
    supportsCrypto,
    supportsLocalStorage,
    version,
  }
}

/**
 * Check if current environment has known compatibility issues
 */
export function hasKnownIssues(): boolean {
  const browserInfo = getBrowserInfo()

  // Known problematic combinations
  if (browserInfo.isEdge && browserInfo.isWindows) {
    // Edge versions below 88 have known SSE issues
    if (browserInfo.version && parseInt(browserInfo.version) < 88) {
      return true
    }
  }

  // Missing critical APIs
  if (!browserInfo.supportsEventSource && !browserInfo.supportsCrypto) {
    return true
  }

  return false
}

/**
 * Get fallback options for problematic browsers
 */
export function getFallbackOptions() {
  const browserInfo = getBrowserInfo()

  return {
    // Use polling instead of SSE for problematic browsers
    usePolling: !browserInfo.supportsEventSource || hasKnownIssues(),
    // Use Math.random instead of crypto for ID generation
    useMathRandom: !browserInfo.supportsCrypto,
    // Use session storage or memory storage
    useSessionStorage: !browserInfo.supportsLocalStorage,
    // Increased timeout for slow networks/enterprise environments
    timeout: browserInfo.isWindows ? 15000 : 10000,
  }
}

/**
 * Log browser compatibility info (development only)
 */
export function logBrowserInfo() {
  if (process.env.NODE_ENV === 'development') {
    const info = getBrowserInfo()
    const fallbacks = getFallbackOptions()

    console.group('🌐 Browser Compatibility Check')
    console.log('Browser Info:', info)
    console.log('Fallback Options:', fallbacks)

    if (hasKnownIssues()) {
      console.warn('⚠️ Known compatibility issues detected')
    } else {
      console.log('✅ Browser compatibility looks good')
    }
    console.groupEnd()
  }
}

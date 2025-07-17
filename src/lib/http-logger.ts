/**
 * Simple HTTP request logger for MCP-remote
 * 
 * Intercepts the global fetch function to log all HTTP requests,
 * with special attention to OAuth-related URLs
 */

import { log, DEBUG } from './utils'

// Store original fetch function
const originalFetch = global.fetch

/**
 * Installs the HTTP request logger
 * Only active when DEBUG is true
 */
export function installHttpLogger(): void {
  if (!DEBUG) return
  
  log('[HTTP-Logger] Installing HTTP request logger')
  
  // Override global fetch with our logging version
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Convert input to string for logging
    const url = input.toString()
    
    // Log all requests
    log(`[HTTP-Request] ${init?.method || 'GET'} ${url}`)
    
    // Log special details for OAuth-related requests
    if (url.includes('oauth') || url.includes('.well-known') || url.includes('authorize') || 
        url.includes('token') || url.includes('register')) {
      log(`[OAuth-URL] ${url}`)
      
      // Log request headers if present
      if (init?.headers) {
        try {
          // Different ways headers might be represented
          let headersObj: Record<string, string> = {}
          
          if (init.headers instanceof Headers) {
            init.headers.forEach((value, key) => {
              // Don't log sensitive authorization headers
              if (key.toLowerCase() !== 'authorization') {
                headersObj[key] = value
              }
            })
          } else if (typeof init.headers === 'object') {
            headersObj = {...init.headers as Record<string, string>}
            // Remove sensitive headers
            delete headersObj['authorization']
            delete headersObj['Authorization']
          }
          
          log(`[OAuth-Headers] ${JSON.stringify(headersObj)}`)
        } catch (e) {
          // If there's any error parsing headers, just skip it
          log('[OAuth-Headers] Could not log headers')
        }
      }
    }
    
    try {
      // Call original fetch
      const response = await originalFetch(input, init)
      
      // Clone the response so we can read the status while preserving the original
      // Only log status for OAuth-related requests to reduce noise
      if (url.includes('oauth') || url.includes('.well-known') || url.includes('authorize') || 
          url.includes('token') || url.includes('register')) {
        log(`[OAuth-Response] Status: ${response.status} ${response.statusText}`)
      }
      
      return response
    } catch (error) {
      log(`[HTTP-Error] ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }
}

/**
 * Uninstalls the HTTP request logger and restores original fetch function
 */
export function uninstallHttpLogger(): void {
  if (global.fetch !== originalFetch) {
    global.fetch = originalFetch
    log('[HTTP-Logger] Restored original fetch function')
  }
}

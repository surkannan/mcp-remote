/**
 * Simple HTTP request logger for MCP-remote
 * 
 * Intercepts the global fetch function to log all HTTP requests,
 * with special attention to OAuth-related URLs, and fixes malformed
 * OAuth discovery URLs that strip server paths
 */

import { log, DEBUG } from './utils'

// Store original fetch function
const originalFetch = global.fetch

// Store the original server URL to fix OAuth endpoint construction
let originalServerUrl: string | null = null

/**
 * Sets the original server URL for OAuth endpoint fixing
 */
export function setOriginalServerUrl(serverUrl: string): void {
  originalServerUrl = serverUrl
  if (DEBUG) {
    log(`[HTTP-Logger] Set original server URL: ${serverUrl}`)
  }
}

/**
 * Fixes malformed OAuth discovery URLs by preserving the server path
 */
function fixOAuthUrl(url: string): string {
  if (!originalServerUrl) return url
  
  try {
    const originalUrl = new URL(originalServerUrl)
    const requestUrl = new URL(url)
    
    // Check if this is a malformed OAuth discovery URL for same domain
    if (requestUrl.origin === originalUrl.origin && 
        (url.includes('/.well-known/oauth-') || url.includes('/.well-known/openid-configuration'))) {
      
      // Extract the well-known path from the request
      const wellKnownMatch = url.match(/\/(\.well-known\/[^?#]*)/)
      if (wellKnownMatch) {
        const wellKnownPath = wellKnownMatch[1]
        
        // Construct the correct URL with the server path preserved
        const fixedUrl = `${originalUrl.origin}${originalUrl.pathname}${wellKnownPath}${requestUrl.search}`
        
        if (fixedUrl !== url) {
          log(`[OAuth-URL-Fix] Fixed malformed URL:`)
          log(`[OAuth-URL-Fix]   Original: ${url}`)
          log(`[OAuth-URL-Fix]   Fixed:    ${fixedUrl}`)
          return fixedUrl
        }
      }
    }
    
    // Fix cross-domain authorization server URLs (e.g., Okta)
    // Pattern: https://domain/.well-known/oauth-authorization-server/path/to/auth/server
    // Should be: https://domain/path/to/auth/server/.well-known/oauth-authorization-server
    if (url.includes('/.well-known/oauth-authorization-server/')) {
      const authServerMatch = url.match(/^(https?:\/\/[^/]+)\/\.well-known\/oauth-authorization-server\/(.+)$/)
      if (authServerMatch) {
        const [, domain, authServerPath] = authServerMatch
        const fixedUrl = `${domain}/${authServerPath}/.well-known/oauth-authorization-server`
        
        if (fixedUrl !== url) {
          log(`[OAuth-URL-Fix] Fixed cross-domain authorization server URL:`)
          log(`[OAuth-URL-Fix]   Original: ${url}`)
          log(`[OAuth-URL-Fix]   Fixed:    ${fixedUrl}`)
          return fixedUrl
        }
      }
    }
    
    // Fix cross-domain registration endpoints
    // The registration endpoint should be derived from the authorization server metadata
    // For now, we'll try to detect and fix common patterns
    if (url.includes('/oauth2/v1/clients') && !originalServerUrl) {
      // This is likely a registration endpoint from OAuth metadata
      // The URL should already be correct from the metadata, so we don't need to fix it
      // But we can log it for debugging
      if (DEBUG) {
        log(`[OAuth-URL-Fix] Registration endpoint detected: ${url}`)
      }
    }
    
    // Also fix same-domain registration URLs that go to root instead of server path
    if (requestUrl.origin === originalUrl.origin && url.endsWith('/register')) {
      const fixedUrl = `${originalUrl.origin}${originalUrl.pathname}register${requestUrl.search}`
      if (fixedUrl !== url) {
        log(`[OAuth-URL-Fix] Fixed same-domain registration URL:`)
        log(`[OAuth-URL-Fix]   Original: ${url}`)
        log(`[OAuth-URL-Fix]   Fixed:    ${fixedUrl}`)
        return fixedUrl
      }
    }
    
  } catch (error) {
    // If URL parsing fails, return original URL
    if (DEBUG) {
      log(`[OAuth-URL-Fix] Error parsing URLs: ${error}`)
    }
  }
  
  return url
}

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
    const originalUrl = input.toString()
    
    // Fix OAuth URLs if needed (this will log the fix details)
    const fixedUrl = fixOAuthUrl(originalUrl)
    const actualInput = fixedUrl !== originalUrl ? fixedUrl : input
    
    // Log special details for OAuth-related requests (headers, etc.)
    if (originalUrl.includes('oauth') || originalUrl.includes('.well-known') || originalUrl.includes('authorize') || 
        originalUrl.includes('token') || originalUrl.includes('register')) {
      
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
      // Log the actual URL being hit right before making the request
      log(`[HTTP-Request] ${init?.method || 'GET'} ${fixedUrl}`)
      
      // Call original fetch with the potentially fixed URL
      const response = await originalFetch(actualInput, init)
      
      // Log response immediately after request for OAuth-related requests
      if (originalUrl.includes('oauth') || originalUrl.includes('.well-known') || originalUrl.includes('authorize') || 
          originalUrl.includes('token') || originalUrl.includes('register')) {
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

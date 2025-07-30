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

    // Fix URLs with double .well-known/oauth-authorization-server (common SDK bug)
    if (url.includes('/.well-known/oauth-authorization-server/') && url.endsWith('/.well-known/oauth-authorization-server')) {
      // Pattern: https://domain/.well-known/oauth-authorization-server/path/to/server/.well-known/oauth-authorization-server
      // Should be: https://domain/path/to/server/.well-known/oauth-authorization-server
      const doubleWellKnownMatch = url.match(
        /^(https?:\/\/[^/]+)\/\.well-known\/oauth-authorization-server\/(.+)\/\.well-known\/oauth-authorization-server$/,
      )
      if (doubleWellKnownMatch) {
        const [, domain, serverPath] = doubleWellKnownMatch
        const fixedUrl = `${domain}/${serverPath}/.well-known/oauth-authorization-server`

        log(`[OAuth-URL-Fix] Fixed double well-known URL:`)
        log(`[OAuth-URL-Fix]   Original: ${url}`)
        log(`[OAuth-URL-Fix]   Fixed:    ${fixedUrl}`)
        return fixedUrl
      }
    }

    // Check if this is a malformed OAuth discovery URL for same domain
    if (
      requestUrl.origin === originalUrl.origin &&
      (url.includes('/.well-known/oauth-') || url.includes('/.well-known/openid-configuration'))
    ) {
      // Extract the well-known path from the request
      const wellKnownMatch = url.match(/\/(\.well-known\/[^?#]*)/)
      if (wellKnownMatch) {
        const wellKnownPath = wellKnownMatch[1]

        // Construct the correct URL with .well-known at gateway level (one level above /mcp/)
        // For a server at /calc/mcp, OAuth endpoints should be at /calc/ (gateway routing path)

        // Start with the original server path
        let serverPath = originalUrl.pathname

        // Remove trailing slash if present
        if (serverPath.endsWith('/')) {
          serverPath = serverPath.slice(0, -1)
        }

        // Find the last slash and remove everything after it to get gateway path
        const lastSlashIndex = serverPath.lastIndexOf('/')
        const gatewayPath = lastSlashIndex > 0 ? serverPath.substring(0, lastSlashIndex) : ''

        const fixedUrl = `${originalUrl.origin}${gatewayPath}/${wellKnownPath}${requestUrl.search}`

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
    // But for gateway routing, we need to go one level up from the MCP server path
    // Skip URLs that already end with .well-known/oauth-authorization-server (likely malformed/double-encoded)
    if (url.includes('/.well-known/oauth-authorization-server/') && !url.endsWith('/.well-known/oauth-authorization-server')) {
      const authServerMatch = url.match(/^(https?:\/\/[^/]+)\/\.well-known\/oauth-authorization-server\/(.+)$/)
      if (authServerMatch) {
        const [, domain, authServerPath] = authServerMatch
        // For gateway routing, remove the last path segment (typically /mcp) to get gateway path
        // authServerPath is like "calc/mcp", we want "calc"
        const lastSlashIndex = authServerPath.lastIndexOf('/')
        const gatewayPath = lastSlashIndex > 0 ? authServerPath.substring(0, lastSlashIndex) : authServerPath.split('/')[0] || ''
        const fixedUrl = gatewayPath
          ? `${domain}/${gatewayPath}/.well-known/oauth-authorization-server`
          : `${domain}/.well-known/oauth-authorization-server`

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
 * Installs the OAuth URL fixer (always active)
 */
export function installOAuthUrlFixer(): void {
  if (global.fetch === originalFetch) {
    // Override global fetch with URL fixing
    global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      // Convert input to string for URL fixing
      const originalUrl = input.toString()

      // Fix OAuth URLs if needed
      const fixedUrl = fixOAuthUrl(originalUrl)
      const actualInput = fixedUrl !== originalUrl ? fixedUrl : input

      // Call original fetch with the potentially fixed URL
      return await originalFetch(actualInput, init)
    }
  }
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

    // Log request headers for all requests (with special handling for OAuth)
    if (init?.headers) {
      try {
        // Different ways headers might be represented
        let headersObj: Record<string, string> = {}

        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            // Don't log sensitive authorization headers in full
            if (key.toLowerCase() === 'authorization') {
              headersObj[key] = '[REDACTED]'
            } else {
              headersObj[key] = value
            }
          })
        } else if (typeof init.headers === 'object') {
          headersObj = { ...(init.headers as Record<string, string>) }
          // Redact sensitive headers
          if (headersObj['authorization']) headersObj['authorization'] = '[REDACTED]'
          if (headersObj['Authorization']) headersObj['Authorization'] = '[REDACTED]'
        }

        if (Object.keys(headersObj).length > 0) {
          log(`[Request-Headers] ${JSON.stringify(headersObj)}`)
        }
      } catch (error) {
        if (DEBUG) {
          log(`[Request-Headers] Error parsing headers: ${error}`)
        }
      }
    }

    try {
      // Log the actual URL being hit right before making the request
      log(`[HTTP-Request] ${init?.method || 'GET'} ${fixedUrl}`)

      // Log OAuth scope information if present in the URL
      if (fixedUrl.includes('scope=') || fixedUrl.includes('authorize') || fixedUrl.includes('token')) {
        try {
          const url = new URL(fixedUrl)
          const scope = url.searchParams.get('scope')
          if (scope) {
            log(`[OAuth-Scopes] Requesting scopes: ${scope}`)
          }

          // Also check for other OAuth parameters of interest
          const responseType = url.searchParams.get('response_type')
          const clientId = url.searchParams.get('client_id')
          const redirectUri = url.searchParams.get('redirect_uri')

          if (responseType || clientId || redirectUri) {
            const oauthParams: Record<string, string> = {}
            if (responseType) oauthParams.response_type = responseType
            if (clientId) oauthParams.client_id = clientId
            if (redirectUri) oauthParams.redirect_uri = redirectUri
            log(`[OAuth-Params] ${JSON.stringify(oauthParams)}`)
          }
        } catch (urlError) {
          // If URL parsing fails, just continue
          if (DEBUG) {
            log(`[OAuth-Scopes] Error parsing URL for scope: ${urlError}`)
          }
        }
      }

      // Call original fetch with the potentially fixed URL
      const response = await originalFetch(actualInput, init)

      // Log response status and headers
      log(`[Response-Status] ${response.status} ${response.statusText}`)

      // Log response headers
      try {
        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          // Don't log sensitive headers in full
          if (key.toLowerCase() === 'set-cookie' || key.toLowerCase() === 'authorization') {
            responseHeaders[key] = '[REDACTED]'
          } else {
            responseHeaders[key] = value
          }
        })

        if (Object.keys(responseHeaders).length > 0) {
          log(`[Response-Headers] ${JSON.stringify(responseHeaders)}`)
        }
      } catch (error) {
        if (DEBUG) {
          log(`[Response-Headers] Error parsing headers: ${error}`)
        }
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

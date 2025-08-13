/**
 * HTTP request interceptor for MCP-remote
 *
 * Provides a generic hook system for intercepting and modifying HTTP requests,
 * with built-in support for OAuth URL fixing and request/response logging.
 */

import { log, debugLog, DEBUG } from './utils'

// Store original fetch function
const originalFetch = global.fetch

// Store the original server URL for context in hooks
let originalServerUrl: string | null = null

// Hook system types
export interface HttpRequestContext {
  url: string
  method: string
  headers?: Record<string, string>
  originalServerUrl: string | null
  isOAuthRelated: boolean
}

export interface HttpResponseContext extends HttpRequestContext {
  response: Response
  status: number
  statusText: string
  responseHeaders: Record<string, string>
  durationMs: number
}

export type RequestHook = (context: HttpRequestContext) => string | null
export type ResponseHook = (context: HttpResponseContext) => void

// Hook registries
const requestHooks: RequestHook[] = []
const responseHooks: ResponseHook[] = []

/**
 * Sets the original server URL for context in hooks
 */
export function setOriginalServerUrl(serverUrl: string): void {
  originalServerUrl = serverUrl
  debugLog(`[HTTP-Interceptor] Set original server URL: ${serverUrl}`)
}

/**
 * Register a request hook that can modify URLs before they are fetched
 * @param hook Function that receives request context and returns modified URL or null
 */
export function registerRequestHook(hook: RequestHook): void {
  requestHooks.push(hook)
  debugLog(`[HTTP-Interceptor] Registered request hook (${requestHooks.length} total)`)
}

/**
 * Register a response hook for logging or processing responses
 * @param hook Function that receives response context
 */
export function registerResponseHook(hook: ResponseHook): void {
  responseHooks.push(hook)
  debugLog(`[HTTP-Interceptor] Registered response hook (${responseHooks.length} total)`)
}

/**
 * Clear all registered hooks
 */
export function clearHooks(): void {
  requestHooks.length = 0
  responseHooks.length = 0
  debugLog(`[HTTP-Interceptor] Cleared all hooks`)
}

/**
 * Check if a URL is OAuth-related
 */
function isOAuthRelated(url: string): boolean {
  return (
    url.includes('/.well-known/oauth-') ||
    url.includes('/.well-known/openid-configuration') ||
    url.includes('/authorize') ||
    url.includes('/token') ||
    url.includes('/register') ||
    url.includes('oauth2/v1/clients') ||
    url.includes('scope=')
  )
}

/**
 * Parse headers from various formats into a plain object
 */
function parseHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const headersObj: Record<string, string> = {}

  if (!headers) return headersObj

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      headersObj[key] = key.toLowerCase() === 'authorization' ? '[REDACTED]' : value
    })
  } else if (typeof headers === 'object') {
    Object.entries(headers as Record<string, string>).forEach(([key, value]) => {
      headersObj[key] = key.toLowerCase() === 'authorization' ? '[REDACTED]' : value
    })
  }

  return headersObj
}

/**
 * Apply request hooks to potentially modify the URL
 */
function applyRequestHooks(context: HttpRequestContext): string {
  let currentUrl = context.url

  for (const hook of requestHooks) {
    try {
      const modifiedUrl = hook({ ...context, url: currentUrl })
      if (modifiedUrl && modifiedUrl !== currentUrl) {
        debugLog(`[Hook] URL modified: ${currentUrl} -> ${modifiedUrl}`)
        currentUrl = modifiedUrl
      }
    } catch (error) {
      debugLog(`[Hook] Error in request hook: ${error}`)
    }
  }

  return currentUrl
}

/**
 * Apply response hooks for logging or processing
 */
function applyResponseHooks(context: HttpResponseContext): void {
  for (const hook of responseHooks) {
    try {
      hook(context)
    } catch (error) {
      debugLog(`[Hook] Error in response hook: ${error}`)
    }
  }
}

/**
 * Built-in OAuth URL fixer hook
 * This replaces the hardcoded fixOAuthUrl function with a hookable implementation
 */
export const defaultOAuthUrlFixer: RequestHook = (context) => {
  const { url, originalServerUrl } = context

  if (!originalServerUrl) return null
  if (process.env.MCP_REMOTE_NOFIX) return null

  try {
    const originalUrl = new URL(originalServerUrl)
    const requestUrl = new URL(url)

    // Fix URLs with double .well-known/oauth-authorization-server (common SDK bug)
    if (url.includes('/.well-known/oauth-authorization-server/') && url.endsWith('/.well-known/oauth-authorization-server')) {
      const doubleWellKnownMatch = url.match(
        /^(https?:\/\/[^/]+)\/\.well-known\/oauth-authorization-server\/(.+)\/\.well-known\/oauth-authorization-server$/,
      )
      if (doubleWellKnownMatch) {
        const [, domain, serverPath] = doubleWellKnownMatch
        const fixedUrl = `${domain}/${serverPath}/.well-known/oauth-authorization-server`

        debugLog(`[OAuth-URL-Fix] Fixed double well-known URL:`)
        debugLog(`[OAuth-URL-Fix]   Original: ${url}`)
        debugLog(`[OAuth-URL-Fix]   Fixed:    ${fixedUrl}`)
        return fixedUrl
      }
    }

    // Check if this is a malformed OAuth discovery URL for same domain
    if (
      requestUrl.origin === originalUrl.origin &&
      (url.includes('/.well-known/oauth-') || url.includes('/.well-known/openid-configuration'))
    ) {
      const wellKnownMatch = url.match(/\/(\.well-known\/[^?#]*)/)
      if (wellKnownMatch) {
        const wellKnownPath = wellKnownMatch[1]

        let serverPath = originalUrl.pathname
        if (serverPath.endsWith('/')) {
          serverPath = serverPath.slice(0, -1)
        }

        const lastSlashIndex = serverPath.lastIndexOf('/')
        const gatewayPath = lastSlashIndex > 0 ? serverPath.substring(0, lastSlashIndex) : ''

        const fixedUrl = `${originalUrl.origin}${gatewayPath}/${wellKnownPath}${requestUrl.search}`

        if (fixedUrl !== url) {
          debugLog(`[OAuth-URL-Fix] Fixed malformed URL:`)
          debugLog(`[OAuth-URL-Fix]   Original: ${url}`)
          debugLog(`[OAuth-URL-Fix]   Fixed:    ${fixedUrl}`)
          return fixedUrl
        }
      }
    }

    // Fix cross-domain authorization server URLs
    if (url.includes('/.well-known/oauth-authorization-server/') && !url.endsWith('/.well-known/oauth-authorization-server')) {
      const authServerMatch = url.match(/^(https?:\/\/[^/]+)\/\.well-known\/oauth-authorization-server\/(.+)$/)
      if (authServerMatch) {
        const [, domain, authServerPath] = authServerMatch
        const lastSlashIndex = authServerPath.lastIndexOf('/')
        const gatewayPath = lastSlashIndex > 0 ? authServerPath.substring(0, lastSlashIndex) : authServerPath.split('/')[0] || ''
        const fixedUrl = gatewayPath
          ? `${domain}/${gatewayPath}/.well-known/oauth-authorization-server`
          : `${domain}/.well-known/oauth-authorization-server`

        if (fixedUrl !== url) {
          debugLog(`[OAuth-URL-Fix] Fixed cross-domain authorization server URL:`)
          debugLog(`[OAuth-URL-Fix]   Original: ${url}`)
          debugLog(`[OAuth-URL-Fix]   Fixed:    ${fixedUrl}`)
          return fixedUrl
        }
      }
    }

    // Fix same-domain registration URLs
    if (requestUrl.origin === originalUrl.origin && url.endsWith('/register')) {
      const fixedUrl = `${originalUrl.origin}${originalUrl.pathname}register${requestUrl.search}`
      if (fixedUrl !== url) {
        debugLog(`[OAuth-URL-Fix] Fixed same-domain registration URL:`)
        debugLog(`[OAuth-URL-Fix]   Original: ${url}`)
        debugLog(`[OAuth-URL-Fix]   Fixed:    ${fixedUrl}`)
        return fixedUrl
      }
    }
  } catch (error) {
    if (DEBUG) {
      debugLog(`[OAuth-URL-Fix] Error parsing URLs: ${error}`)
    }
  }

  return null
}

/**
 * Built-in response logging hook
 */
export const defaultResponseLogger: ResponseHook = (context) => {
  if (!DEBUG) return

  const { url, method, status, statusText, responseHeaders, durationMs } = context

  debugLog(`[HTTP-Request] ${method} ${url}`)
  debugLog(`[Response-Status] ${status} ${statusText}`)
  debugLog(`[Response-Time] ${durationMs}ms`)

  if (Object.keys(responseHeaders).length > 0) {
    debugLog(`[Response-Headers] ${JSON.stringify(responseHeaders)}`)
  }

  // Log OAuth-specific information
  if (context.isOAuthRelated) {
    try {
      const urlObj = new URL(url)
      const scope = urlObj.searchParams.get('scope')
      if (scope) {
        debugLog(`[OAuth-Scopes] Requesting scopes: ${scope}`)
      }

      const responseType = urlObj.searchParams.get('response_type')
      const clientId = urlObj.searchParams.get('client_id')
      const redirectUri = urlObj.searchParams.get('redirect_uri')

      if (responseType || clientId || redirectUri) {
        const oauthParams: Record<string, string> = {}
        if (responseType) oauthParams.response_type = responseType
        if (clientId) oauthParams.client_id = clientId
        if (redirectUri) oauthParams.redirect_uri = redirectUri
        debugLog(`[OAuth-Params] ${JSON.stringify(oauthParams)}`)
      }
    } catch (urlError) {
      debugLog(`[OAuth-Scopes] Error parsing URL for scope: ${urlError}`)
    }
  }
}

/**
 * Installs the HTTP interceptor with default OAuth URL fixing (always active)
 */
export function installOAuthUrlFixer(): void {
  if (global.fetch === originalFetch) {
    // Register the default OAuth URL fixer if no hooks are registered yet
    if (requestHooks.length === 0) {
      registerRequestHook(defaultOAuthUrlFixer)
    }

    // Install the interceptor
    installHttpInterceptor()
  }
}

/**
 * Installs the HTTP debug logger (registers default response logging hook)
 */
export function installHttpDebugLogger(): void {
  if (!DEBUG) return

  // Register the response logger if not already registered
  if (responseHooks.length === 0) {
    registerResponseHook(defaultResponseLogger)
  }

  // Ensure the interceptor is installed
  installHttpInterceptor()

  debugLog('[HTTP-Interceptor] Registered HTTP request logging hooks')
}

/**
 * Core HTTP interceptor that applies all registered hooks
 */
function installHttpInterceptor(): void {
  if (global.fetch !== originalFetch) return

  debugLog('[HTTP-Interceptor] Installing HTTP interceptor')

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const originalUrl = input.toString()
    const method = init?.method || 'GET'
    const headers = parseHeaders(init?.headers)
    const oauthRelated = isOAuthRelated(originalUrl)

    // Create request context
    const requestContext: HttpRequestContext = {
      url: originalUrl,
      method,
      headers,
      originalServerUrl,
      isOAuthRelated: oauthRelated,
    }

    // Apply request hooks to potentially modify the URL
    const finalUrl = applyRequestHooks(requestContext)
    const actualInput = finalUrl !== originalUrl ? finalUrl : input

    // Log request headers if in debug mode
    if (DEBUG && Object.keys(headers).length > 0) {
      debugLog(`[Request-Headers] ${JSON.stringify(headers)}`)
    }

    try {
      const startMs = Date.now()
      const response = await originalFetch(actualInput, init)
      const durationMs = Date.now() - startMs

      // Parse response headers
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = key.toLowerCase() === 'set-cookie' || key.toLowerCase() === 'authorization' ? '[REDACTED]' : value
      })

      // Create response context
      const responseContext: HttpResponseContext = {
        ...requestContext,
        url: finalUrl,
        response,
        status: response.status,
        statusText: response.statusText,
        responseHeaders,
        durationMs,
      }

      // Apply response hooks
      applyResponseHooks(responseContext)

      return response
    } catch (error) {
      log(`[HTTP-Error] ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }
}

/**
 * Uninstalls the HTTP interceptor and restores original fetch function
 */
export function uninstallHttpInterceptor(): void {
  if (global.fetch !== originalFetch) {
    global.fetch = originalFetch
    debugLog('[HTTP-Interceptor] Restored original fetch function')
  }
}



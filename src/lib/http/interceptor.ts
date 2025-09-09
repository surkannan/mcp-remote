import { debugLog, DEBUG } from '../utils'
import { applyRequestHooks, applyResponseHooks, applyResponseTransformHooks } from './registry'
import type { HttpRequestContext, HttpResponseContext } from './types'
import { isOAuthRelated, parseHeaders, redactResponseHeaders } from './utils'

const originalFetch = global.fetch
let originalServerUrl: string | null = null

export function setOriginalServerUrl(serverUrl: string): void {
  originalServerUrl = serverUrl
  debugLog(`[HTTP-Interceptor] Set original server URL: ${serverUrl}`)
}

export function installHttpInterceptor(): void {
  if (global.fetch !== originalFetch) return

  debugLog('[HTTP-Interceptor] Installing HTTP interceptor')

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const originalUrl = input.toString()
    const method = init?.method || 'GET'
    const headers = parseHeaders(init?.headers)
    const oauthRelated = isOAuthRelated(originalUrl)

    const requestContext: HttpRequestContext = {
      url: originalUrl,
      method,
      headers,
      originalServerUrl,
      isOAuthRelated: oauthRelated,
    }

    const finalUrl = applyRequestHooks(requestContext)
    const actualInput = finalUrl !== originalUrl ? finalUrl : input

    if (DEBUG && Object.keys(headers).length > 0) {
      debugLog(`[Request-Headers] ${JSON.stringify(headers)}`)
    }

    try {
      const startMs = Date.now()
      const response = await originalFetch(actualInput, init)
      const durationMs = Date.now() - startMs

      const responseHeaders = redactResponseHeaders(response.headers)

      const responseContext: HttpResponseContext = {
        ...requestContext,
        url: finalUrl,
        response,
        status: response.status,
        statusText: response.statusText,
        responseHeaders,
        durationMs,
      }

      const finalResponseContext = applyResponseTransformHooks(responseContext)
      applyResponseHooks(finalResponseContext)

      return finalResponseContext.response
    } catch (error) {
      // use non-debug log for visibility
      const msg = error instanceof Error ? error.message : String(error)
      console.log(`[HTTP-Error] ${msg}`)
      throw error
    }
  }
}

export function uninstallHttpInterceptor(): void {
  if (global.fetch !== originalFetch) {
    global.fetch = originalFetch
    debugLog('[HTTP-Interceptor] Restored original fetch function')
  }
}

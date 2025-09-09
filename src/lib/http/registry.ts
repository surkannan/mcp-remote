import { debugLog } from '../utils'
import type {
  HttpRequestContext,
  HttpResponseContext,
  RequestHook,
  ResponseHook,
  ResponseTransformHook,
} from './types'

// Hook registries
const requestHooks: RequestHook[] = []
const responseHooks: ResponseHook[] = []
const responseTransformHooks: ResponseTransformHook[] = []

export function registerRequestHook(hook: RequestHook): void {
  requestHooks.push(hook)
  debugLog(`[HTTP-Interceptor] Registered request hook (${requestHooks.length} total) `)
}

export function registerResponseHook(hook: ResponseHook): void {
  responseHooks.push(hook)
  debugLog(`[HTTP-Interceptor] Registered response hook (${responseHooks.length} total) `)
}

export function registerResponseTransformHook(hook: ResponseTransformHook): void {
  responseTransformHooks.push(hook)
  debugLog(
    `[HTTP-Interceptor] Registered response transform hook (${responseTransformHooks.length} total) `,
  )
}

export function clearHooks(): void {
  requestHooks.length = 0
  responseHooks.length = 0
  responseTransformHooks.length = 0
  debugLog(`[HTTP-Interceptor] Cleared all hooks`)
}

export function applyRequestHooks(context: HttpRequestContext): string {
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

export function applyResponseHooks(context: HttpResponseContext): void {
  for (const hook of responseHooks) {
    try {
      hook(context)
    } catch (error) {
      debugLog(`[Hook] Error in response hook: ${error}`)
    }
  }
}

export function applyResponseTransformHooks(context: HttpResponseContext): HttpResponseContext {
  let current = context

  for (const hook of responseTransformHooks) {
    try {
      const maybe = hook(current)
      if (maybe && maybe !== current.response) {
        const transformedHeaders: Record<string, string> = {}
        maybe.headers.forEach((value, key) => {
          transformedHeaders[key] =
            key.toLowerCase() === 'set-cookie' || key.toLowerCase() === 'authorization' ? '[REDACTED]' : value
        })

        debugLog(`[Hook] Response transformed: status ${current.status} -> ${maybe.status}`)

        current = {
          ...current,
          response: maybe,
          status: maybe.status,
          statusText: maybe.statusText,
          responseHeaders: transformedHeaders,
        }
      }
    } catch (error) {
      debugLog(`[Hook] Error in response transform hook: ${error}`)
    }
  }

  return current
}

export const _internal = {
  requestHooks,
  responseHooks,
  responseTransformHooks,
}

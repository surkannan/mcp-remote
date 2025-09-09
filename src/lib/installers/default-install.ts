import { debugLog, DEBUG } from '../utils'
import { installHttpInterceptor, setOriginalServerUrl } from '../http/interceptor'
import { registerRequestHook, registerResponseHook, registerResponseTransformHook } from '../http/registry'
import { defaultOAuthUrlFixer } from '../hooks/oauth-url-fixer'
import { defaultResponseLogger } from '../hooks/response-logger'
import { default405To404Transform } from '../hooks/transform-405-to-404'

// Backward-compat helpers keeping previous ergonomics

export function installOAuthUrlFixer(): void {
  // Register the default OAuth URL fixer if no hooks are registered yet
  registerRequestHook(defaultOAuthUrlFixer)
  installHttpInterceptor()
  debugLog('[HTTP-Interceptor] OAuth URL fixer installed')
}

export function installHttpDebugLogger(): void {
  if (!DEBUG) return
  registerResponseHook(defaultResponseLogger)
  installHttpInterceptor()
  debugLog('[HTTP-Interceptor] Registered HTTP request logging hooks')
}

export function install405To404Transform(): void {
  registerResponseTransformHook(default405To404Transform)
  installHttpInterceptor()
  debugLog('[HTTP-Interceptor] 405->404 response transform installed')
}

// Re-export for convenience in old import style
export { setOriginalServerUrl }

/**
 * Example usage of the HTTP interceptor hook system for OAuth URL customization
 * 
 * This file shows how to implement custom OAuth URL fixing logic using hooks
 * instead of hardcoded patches in http-interceptor.ts
 */

import { registerRequestHook, registerResponseHook, type HttpRequestContext, type HttpResponseContext } from './http-interceptor.js'

/**
 * Example custom OAuth URL fixer hook
 * This demonstrates how to implement your own URL patching logic
 */
export function customOAuthUrlFixer(context: HttpRequestContext): string | null {
  const { url, originalServerUrl, isOAuthRelated } = context
  
  if (!isOAuthRelated || !originalServerUrl) return null
  
  try {
    // Example: Fix a specific OAuth provider's URL pattern
    if (url.includes('example.com') && url.includes('/.well-known/oauth-authorization-server')) {
      // Your custom logic here
      const fixedUrl = url.replace('/double/path/', '/single/path/')
      
      if (fixedUrl !== url) {
        console.log(`[Custom-OAuth-Fix] ${url} -> ${fixedUrl}`)
        return fixedUrl
      }
    }
    
    // Example: Handle custom registration endpoint patterns
    if (url.includes('/custom-register')) {
      const originalUrl = new URL(originalServerUrl)
      const fixedUrl = `${originalUrl.origin}${originalUrl.pathname}/oauth/register`
      
      console.log(`[Custom-Registration-Fix] ${url} -> ${fixedUrl}`)
      return fixedUrl
    }
  } catch (error) {
    console.log(`[Custom-OAuth-Fix] Error: ${error}`)
  }
  
  return null
}

/**
 * Example custom response logging hook
 * This demonstrates how to implement custom response processing
 */
export function customOAuthLogger(context: HttpResponseContext): void {
  const { url, isOAuthRelated, status, response } = context
  
  if (!isOAuthRelated) return
  
  // Log specific OAuth endpoints
  if (url.includes('/token')) {
    console.log(`[Custom-OAuth-Log] Token endpoint response: ${status}`)
  }
  
  if (url.includes('/.well-known/')) {
    console.log(`[Custom-OAuth-Log] Discovery endpoint response: ${status}`)
  }
  
  // Example: Store OAuth metadata for later use
  if (url.includes('/.well-known/oauth-authorization-server') && status === 200) {
    // You could store the response for later processing
    console.log(`[Custom-OAuth-Log] Received OAuth authorization server metadata`)
  }
}

/**
 * Register your custom hooks
 * Call this function to install your custom OAuth handling logic
 */
export function installCustomOAuthHooks(): void {
  registerRequestHook(customOAuthUrlFixer)
  registerResponseHook(customOAuthLogger)
  
  console.log('[Custom-OAuth-Hooks] Installed custom OAuth hooks')
}

/**
 * Example of a conditional hook that only applies to specific domains
 */
export function domainSpecificOAuthFixer(context: HttpRequestContext): string | null {
  const { url, isOAuthRelated } = context
  
  if (!isOAuthRelated) return null
  
  try {
    const urlObj = new URL(url)
    
    // Only apply fixes to specific domains
    if (urlObj.hostname === 'auth.example.com') {
      // Your domain-specific logic here
      if (url.includes('/broken-path/')) {
        return url.replace('/broken-path/', '/fixed-path/')
      }
    }
  } catch (error) {
    console.log(`[Domain-Specific-Fix] Error: ${error}`)
  }
  
  return null
}

/**
 * Example of pattern-based URL fixing
 */
export function patternBasedOAuthFixer(context: HttpRequestContext): string | null {
  const { url, isOAuthRelated } = context
  
  if (!isOAuthRelated) return null
  
  // Define patterns and their fixes
  const fixes = [
    {
      pattern: /\/api\/v1\/oauth\/(.+)/,
      replacement: '/oauth/v2/$1'
    },
    {
      pattern: /\/legacy-auth\/(.+)/,
      replacement: '/auth/$1'
    }
  ]
  
  for (const fix of fixes) {
    if (fix.pattern.test(url)) {
      const fixedUrl = url.replace(fix.pattern, fix.replacement)
      console.log(`[Pattern-Fix] ${url} -> ${fixedUrl}`)
      return fixedUrl
    }
  }
  
  return null
}
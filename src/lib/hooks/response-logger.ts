import { DEBUG, debugLog } from '../http/utils'
import type { ResponseHook } from '../http/types'

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

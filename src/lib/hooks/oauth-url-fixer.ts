import { DEBUG, debugLog } from '../http/utils'
import type { RequestHook } from '../http/types'

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

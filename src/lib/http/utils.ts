import { DEBUG, debugLog } from '../utils'

export function isOAuthRelated(url: string): boolean {
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

export function parseHeaders(headers: HeadersInit | undefined): Record<string, string> {
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

export function redactResponseHeaders(headers: Headers): Record<string, string> {
  const responseHeaders: Record<string, string> = {}
  headers.forEach((value, key) => {
    responseHeaders[key] = key.toLowerCase() === 'set-cookie' || key.toLowerCase() === 'authorization' ? '[REDACTED]' : value
  })
  return responseHeaders
}

export { DEBUG, debugLog }

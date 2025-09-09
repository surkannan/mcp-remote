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
export type ResponseTransformHook = (context: HttpResponseContext) => Response | null

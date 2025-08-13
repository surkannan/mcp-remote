# HTTP Interceptor and Hooks

This project ships an HTTP fetch interceptor with a small, composable hooks system for request URL rewriting, response transformation, and response processing/logging.

Relevant files:

- `src/lib/http-interceptor.ts`
- `src/client.ts` (example of how it’s installed)
- `src/lib/utils.ts` (logging utilities: `DEBUG`, `log`, `debugLog`)

## What it does

- Replaces `global.fetch` once and applies:
  - Request hooks: can rewrite the outgoing URL before the fetch executes.
  - Response transform hooks: can replace/modify the Response before processing/logging.
  - Response hooks: can log/process the response after it returns.
- Provides built-in hooks:
  - `defaultOAuthUrlFixer` (request): fixes common malformed OAuth discovery/registration URLs.
  - `defaultResponseLogger` (response): structured HTTP/OAuth logging, including response time in ms (when debug is enabled).
- Redacts sensitive headers in logs (`authorization`, `set-cookie`).

## Quick start

Typical setup (done automatically by `src/client.ts`):

```ts
import {
  setOriginalServerUrl,
  installOAuthUrlFixer,
  installHttpDebugLogger,
} from './src/lib/http-interceptor'

// 1) Provide server URL context (required for default OAuth URL fixes)
setOriginalServerUrl(serverUrl)

// 2) Install the interceptor with the default OAuth URL fixer
installOAuthUrlFixer() // idempotent

// 3) Register the default response logger if DEBUG is on
installHttpDebugLogger() // no-op unless DEBUG === true
```

Notes:
- You usually don’t call the core installer directly. The exported helpers above install the interceptor if needed.
- `src/client.ts` already does all three steps for the CLI.

## Hooks API

- Request hook signature:

  ```ts
  type RequestHook = (ctx: HttpRequestContext) => string | null
  // Return a new URL string to rewrite the request, or null to leave unchanged.
  ```
  Context: `url`, `method`, `headers` (Authorization redacted), `originalServerUrl`, `isOAuthRelated`.

- Response hook signature:

  ```ts
  type ResponseHook = (ctx: HttpResponseContext) => void
  ```
  Context includes the request fields plus: `response`, `status`, `statusText`, `responseHeaders` (Set-Cookie/Authorization redacted).

- Response transform hook signature:

  ```ts
  type ResponseTransformHook = (ctx: HttpResponseContext) => Response | null
  // Return a new Response to replace the original, or null to leave unchanged.
  ```

- Managing hooks:
  - `registerRequestHook(hook)`
  - `registerResponseHook(hook)`
  - `registerResponseTransformHook(hook)`
  - `clearHooks()` to remove all hooks
  - Order matters; request hooks see the URL after prior hooks; response transforms run before response hooks.

## Built-in hooks

- `defaultOAuthUrlFixer` (request)
  - Fixes double `/.well-known/oauth-authorization-server/.../.well-known/oauth-authorization-server`.
  - Corrects malformed same-origin discovery paths to the gateway path.
  - Normalizes cross-domain authorization server URLs.
  - Adjusts same-domain `.../register` to server path.
  - Respects `MCP_REMOTE_NOFIX` env var to disable.
  - Requires `setOriginalServerUrl(serverUrl)` for context.

- `defaultResponseLogger` (response)
  - Logs method, URL, status, response time (ms), headers, and OAuth query params when relevant, only if `DEBUG` is true.
  - Source: `src/lib/http-interceptor.ts`:

```ts
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
```

## Add your own hooks

- Request URL rewrite (example):

```ts
import { registerRequestHook } from './src/lib/http-interceptor'

registerRequestHook((ctx) => {
  if (!ctx.isOAuthRelated) return null
  const u = new URL(ctx.url)
  if (u.protocol !== 'https:') {
    u.protocol = 'https:'
    return u.toString()
  }
  return null
})
```

- Response metrics/logging (example):

```ts
import { registerResponseHook } from './src/lib/http-interceptor'
import { debugLog } from './src/lib/utils'

registerResponseHook((ctx) => {
  debugLog(`[Metrics] ${ctx.method} ${ctx.url} -> ${ctx.status}`)
})
```

- Response transform (example: 405 → 404):

```ts
import { registerResponseTransformHook } from './src/lib/http-interceptor'

registerResponseTransformHook((ctx) => {
  if (ctx.status === 405) {
    return new Response(ctx.response.body, {
      status: 404,
      statusText: 'Not Found',
      headers: ctx.response.headers,
    })
  }
  return null
})
```

Tip: If you want both default logging and your custom response hook, call `installHttpDebugLogger()` first (so the default logger auto-registers), then `registerResponseHook(...)` for yours.

## Effective logging

- Enable debug mode (CLI): pass `--debug`.
  - `parseCommandLineArgs()` in `src/lib/utils.ts` sets `DEBUG = true`.
  - With debug on, `debugLog()` writes to stderr and to a file at `~/.mcp-auth/<serverHash>_debug.log`.
  - The `<serverHash>` comes from `getServerUrlHash(serverUrl)` and is stored in `global.currentServerUrlHash` by the arg parser.
- Use `log()` for user-facing info/errors (always stderr; mirrored to the debug file when `DEBUG` is on).
- Use `debugLog()` for detailed traces in hooks and internal flows. Avoid logging raw secrets (tokens, codes). Prefer presence/length or masked values.
- Redaction is automatic for `Authorization` (request) and `Authorization`/`Set-Cookie` (response) headers.

## Disable OAuth URL fixes

- Set `MCP_REMOTE_NOFIX=1` (or any truthy value) in the environment to bypass `defaultOAuthUrlFixer` logic while keeping the interceptor.

## Uninstalling and cleanup

- `uninstallHttpInterceptor()` restores the original `fetch`.
- `clearHooks()` empties request, response, and response transform hook registries.

## Gotchas

- Hooks are process-global; there’s no per-connection isolation.
- Hook order matters. Request hooks run sequentially; each sees the latest URL.
- `uninstallHttpInterceptor()` does not delete registered hooks—`clearHooks()` if you need a clean slate.
- If you register any request hook before calling `installOAuthUrlFixer()`, the default fixer will not auto-register. Register it manually if needed.

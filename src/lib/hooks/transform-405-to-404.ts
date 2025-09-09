import type { ResponseTransformHook } from '../http/types'

export const default405To404Transform: ResponseTransformHook = (ctx) => {
  if (ctx.status === 405) {
    return new Response(ctx.response.body, {
      status: 404,
      statusText: 'Not Found',
      headers: ctx.response.headers,
    })
  }
  return null
}

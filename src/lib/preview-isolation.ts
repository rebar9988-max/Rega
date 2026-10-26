/** A branch preview must never consume inherited production credentials or cached production data. */
export function withPreviewIsolation<E extends { REGA_ISOLATED_PREVIEW?: string }, C>(
  next: (request: Request, env: E, ctx: C) => Response | Promise<Response>,
) {
  return (request: Request, env: E, ctx: C): Response | Promise<Response> => {
    if (env.REGA_ISOLATED_PREVIEW !== "1") return next(request, env, ctx);
    const health = new URL(request.url).pathname === "/__preview-health" && request.method === "GET";
    return Response.json({ ok: health, mode: "isolated-preview", applicationReady: false }, {
      status: health ? 200 : 503,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
    });
  };
}

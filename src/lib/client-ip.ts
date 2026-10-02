/**
 * Client IP for rate limiting and abuse keys.
 * On Cloudflare, `cf-connecting-ip` is set by the edge and cannot be forged by the client; `x-forwarded-for`
 * can (a client may send its own value), so it is only a fallback for non-Cloudflare hosts (Docker/Node).
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Masks an email for logs: "a***@example.org". Keeps the domain for abuse analysis, drops the identity. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? `${email[0]}***${email.slice(at)}` : "***";
}

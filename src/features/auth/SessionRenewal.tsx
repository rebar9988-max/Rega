"use client";

import { useEffect } from "react";
import { SESSION_RENEW_PATH, renewalDue } from "./session-policy";

/** When this page last got a renewed session cookie (ms since epoch). Per page load; nothing is stored in the browser. */
let lastRenewedAt: number | null = null;
let inFlight = false;

/** Asks Auth.js's own session endpoint to re-issue the session cookie (new server-side expiry and new cookie expiry). */
async function renew() {
  if (inFlight) return;
  inFlight = true;
  const startedAt = Date.now();
  try {
    const res = await fetch(SESSION_RENEW_PATH, { credentials: "same-origin", cache: "no-store", headers: { accept: "application/json" } });
    // Read (and discard) the small answer: a response body that is never consumed keeps the request open for the browser.
    await res.text();
    if (res.ok) lastRenewedAt = startedAt;
  } catch {
    // Offline or a brief outage: the next page load, or the tab becoming visible again, tries once more. Never signs anyone out.
  } finally {
    inFlight = false;
  }
}

/**
 * Rolling session renewal. Rendered only for a signed-in visitor (shell header and dashboard layout), so anonymous
 * pages stay edge-cacheable. The response carries the new HttpOnly cookie; the page never reads or stores a token.
 */
export function SessionRenewal() {
  useEffect(() => {
    const renewIfDue = () => {
      if (renewalDue(lastRenewedAt, Date.now())) void renew();
    };
    renewIfDue();
    const onVisible = () => {
      if (document.visibilityState === "visible") renewIfDue();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return null;
}

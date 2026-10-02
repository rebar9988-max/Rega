"use client";

import { useEffect } from "react";

/** Fires once per page view; failures are irrelevant to the visitor. */
export function ViewPing({ slug }: { slug: string }) {
  useEffect(() => {
    const body = JSON.stringify({ slug });
    if (!navigator.sendBeacon?.("/api/v1/views", new Blob([body], { type: "application/json" }))) {
      fetch("/api/v1/views", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  }, [slug]);
  return null;
}

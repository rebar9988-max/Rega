"use client";

import { useEffect } from "react";

/** Registers /sw.js (offline page + cached build assets) in production builds. Failures are ignored: the site works without it. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

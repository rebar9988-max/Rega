"use client";

import { useState } from "react";
import { FigmaIcon } from "@/components/home/FigmaIcon";

/**
 * Shares the business page: the device's share sheet where there is one (phones), else the link is copied.
 * The URL is the page's own canonical address, passed in by the server.
 */
export function ShareButton({ url, title, label, copiedLabel, className }: { url: string; title: string; label: string; copiedLabel: string; className: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    try {
      if (typeof navigator.share === "function") return await navigator.share({ title, url });
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Closing the share sheet rejects; nothing to report.
    }
  }

  return (
    <button type="button" onClick={share} className={className} data-testid="share-button">
      <FigmaIcon name="share-2" className="size-5 shrink-0" />
      <span>{label}</span>
      <span role="status" className="sr-only">{copied ? copiedLabel : ""}</span>
    </button>
  );
}

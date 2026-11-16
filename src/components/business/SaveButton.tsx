"use client";

import { useState, useSyncExternalStore } from "react";
import { Link } from "@/i18n/routing";
import { FigmaIcon } from "@/components/home/FigmaIcon";
import { getSavedBusinesses, getServerSavedBusinesses, subscribeSavedBusinesses, toggleSavedBusiness } from "@/lib/saved-store";

function useSaved() {
  return useSyncExternalStore(subscribeSavedBusinesses, getSavedBusinesses, getServerSavedBusinesses);
}

/**
 * Saves the business on this device (localStorage only, no account). The visible label carries the state ("Save" /
 * "Saved", no aria-pressed so the name and state never contradict), the status region announces the change. The server render shows "not saved"; the browser corrects it on hydration.
 */
export function SaveButton({ slug, label, savedLabel, addedText, removedText, className }: {
  slug: string; label: string; savedLabel: string; addedText: string; removedText: string; className: string;
}) {
  const saved = useSaved().includes(slug);
  // Announce only what the visitor just did (not the restored state on page load).
  const [announcement, setAnnouncement] = useState("");
  function toggle() {
    setAnnouncement(saved ? removedText : addedText);
    toggleSavedBusiness(slug);
  }
  return (
    <button type="button" onClick={toggle} className={className} data-testid="save-button">
      <FigmaIcon name="bookmark" className={`size-5 shrink-0 ${saved ? "fill-current" : ""}`} />
      <span>{saved ? savedLabel : label}</span>
      <span role="status" className="sr-only">{announcement}</span>
    </button>
  );
}

/** "Saved businesses (n)" link to the saved page; hidden until this browser has saved something. */
export function SavedLink({ label, className }: { label: string; className?: string }) {
  const count = useSaved().length;
  if (count === 0) return null;
  return (
    <Link href="/saved" className={className} data-testid="saved-link">
      {label.replace("{count}", String(count))}
    </Link>
  );
}

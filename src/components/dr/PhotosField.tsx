"use client";

/**
 * Gallery photos for a business (up to `max`). Same upload path as the logo and cover (MediaField): the server checks
 * type, size and permission and returns a short-lived pre-signed URL, the browser uploads straight to storage, and
 * the public URLs go into hidden `photoUrls` fields. Nothing is saved until the form is. The server accepts only
 * files this person uploaded (or photos the listing already has).
 */
import { useId, useState } from "react";
import { useTranslations } from "next-intl";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024;

type State = "idle" | "uploading" | "done" | "error" | "tooLarge" | "badType" | "notConfigured";

export function PhotosField({ label, initial, max, businessId, storageReady }: {
  label: string; initial: string[]; max: number; businessId?: string; storageReady: boolean;
}) {
  const t = useTranslations("bizForm");
  const id = useId();
  const [urls, setUrls] = useState<string[]>(initial);
  const [state, setState] = useState<State>(storageReady ? "idle" : "notConfigured");
  const full = urls.length >= max;

  async function uploadOne(file: File): Promise<string | State> {
    if (!IMAGE_TYPES.includes(file.type)) return "badType";
    if (file.size > MAX_BYTES) return "tooLarge";
    try {
      const res = await fetch("/api/v1/media/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name.slice(0, 300), mimeType: file.type, sizeBytes: file.size, ...(businessId ? { businessId } : {}) }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 503) return "notConfigured";
      if (!res.ok || !body?.ok) return "error";
      const put = await fetch(body.data.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      return put.ok ? (body.data.publicUrl as string) : "error";
    } catch {
      return "error";
    }
  }

  async function upload(files: File[]) {
    setState("uploading");
    let next = urls;
    let last: State = "done";
    for (const file of files) {
      if (next.length >= max) break;
      const result = await uploadOne(file);
      if (result.startsWith("https://")) next = [...next, result];
      else last = result as State;
    }
    setUrls(next);
    setState(last);
  }

  const message = state === "idle" ? null : t(`upload_${state}`);
  return (
    <div className="flex flex-col gap-2 sm:col-span-2" data-testid="photos-field">
      <label htmlFor={id} className="text-sm font-semibold">{label} <span className="font-normal text-muted">({urls.length}/{max})</span></label>
      {urls.map((u) => <input key={u} type="hidden" name="photoUrls" value={u} />)}
      {urls.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {urls.map((u) => (
            <li key={u} className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="aspect-[4/3] w-full rounded-xl border border-line bg-surface-2 object-cover" />
              <button type="button" onClick={() => setUrls(urls.filter((x) => x !== u))} className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold hover:border-brand hover:text-brand">{t("removeImage")}</button>
            </li>
          ))}
        </ul>
      )}
      <input id={id} type="file" multiple accept={IMAGE_TYPES.join(",")} disabled={state === "notConfigured" || state === "uploading" || full}
        onChange={(e) => { const f = [...(e.target.files ?? [])]; if (f.length) void upload(f); e.target.value = ""; }}
        className="max-w-full text-sm file:me-3 file:min-h-10 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:text-sm file:font-semibold disabled:opacity-60" data-testid="upload-photos" />
      {message && <p role={state === "done" ? "status" : "alert"} className={`text-xs ${state === "done" ? "text-muted" : "font-semibold text-brand"}`} data-testid="upload-photos-state">{message}</p>}
    </div>
  );
}

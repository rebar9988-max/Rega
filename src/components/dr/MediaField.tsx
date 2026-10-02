"use client";

/**
 * Image control for a business logo or cover. Uses the existing upload endpoint (POST /api/v1/media/upload-url):
 * the server validates type, size and permission and returns a short-lived pre-signed URL; the browser uploads the
 * file straight to storage and the public URL goes into a hidden form field. The URL is only saved with the form.
 * When storage is not configured on the server the control says so instead of pretending to upload.
 */
import { useId, useState } from "react";
import { useTranslations } from "next-intl";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024;

type State = "idle" | "uploading" | "done" | "error" | "tooLarge" | "badType" | "notConfigured";

export function MediaField({ name, label, initial, businessId, storageReady, invalid, wide }: {
  name: "logoUrl" | "coverUrl"; label: string; initial: string; businessId?: string; storageReady: boolean; invalid?: boolean; wide?: boolean;
}) {
  const t = useTranslations("bizForm");
  const id = useId();
  const [url, setUrl] = useState(initial);
  const [state, setState] = useState<State>(storageReady ? "idle" : "notConfigured");

  async function upload(file: File) {
    if (!IMAGE_TYPES.includes(file.type)) return setState("badType");
    if (file.size > MAX_BYTES) return setState("tooLarge");
    setState("uploading");
    try {
      const res = await fetch("/api/v1/media/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name.slice(0, 300), mimeType: file.type, sizeBytes: file.size, ...(businessId ? { businessId } : {}) }),
      });
      const body = await res.json().catch(() => null);
      if (res.status === 503) return setState("notConfigured");
      if (!res.ok || !body?.ok) return setState("error");
      const put = await fetch(body.data.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) return setState("error");
      setUrl(body.data.publicUrl);
      setState("done");
    } catch {
      setState("error");
    }
  }

  const message = state === "idle" ? null : t(`upload_${state}`);
  return (
    <div className={`flex flex-col gap-2 ${wide ? "sm:col-span-1" : ""}`}>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <input type="hidden" name={name} value={url} />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={`${name === "logoUrl" ? "size-24 rounded-2xl" : "h-24 w-full rounded-xl"} border border-line bg-surface-2 object-cover`} />
      ) : (
        <div aria-hidden="true" className={`${name === "logoUrl" ? "size-24 rounded-2xl" : "h-24 w-full rounded-xl"} border border-dashed border-line bg-surface-2`} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input id={id} type="file" accept={IMAGE_TYPES.join(",")} disabled={state === "notConfigured" || state === "uploading"} aria-invalid={invalid}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }}
          className="max-w-full text-sm file:me-3 file:min-h-10 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:text-sm file:font-semibold disabled:opacity-60" data-testid={`upload-${name}`} />
        {url && (
          <button type="button" onClick={() => { setUrl(""); setState(storageReady ? "idle" : "notConfigured"); }} className="min-h-10 rounded-lg border border-line px-3 text-xs font-semibold hover:border-brand hover:text-brand">{t("removeImage")}</button>
        )}
      </div>
      {message && <p role={state === "done" ? "status" : "alert"} className={`text-xs ${state === "done" ? "text-muted" : "font-semibold text-brand"}`} data-testid={`upload-${name}-state`}>{message}</p>}
    </div>
  );
}

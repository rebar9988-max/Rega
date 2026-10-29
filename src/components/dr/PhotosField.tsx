"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BUSINESS_IMAGE_ACCEPT,
  imageFromFile,
  uploadBusinessImage,
} from "@/features/business-images/client";
import { BusinessImageEditor } from "./BusinessImageEditor";
export function PhotosField({
  label,
  initial,
  max,
  businessId,
  storageReady,
  onBusyChange, onValueChange,
}: {
  label: string;
  initial: string[];
  max: number;
  businessId?: string;
  storageReady: boolean;
  onBusyChange?: (delta: number) => void;
  onValueChange?: () => void;
}) {
  const t = useTranslations("businessImages"),
    tb = useTranslations("bizForm"),
    id = useId();
  const [urls, setUrls] = useState(initial),
    [source, setSource] = useState<Awaited<
      ReturnType<typeof imageFromFile>
    > | null>(null);
  const [decoding, setDecoding] = useState(false);
  // Index of the photo being replaced (its slot and order are kept), or null when adding.
  const [replacing, setReplacing] = useState<number | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<File[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!source) return;
    onBusyChange?.(1);
    return () => {
      URL.revokeObjectURL(source.url);
      onBusyChange?.(-1);
    };
  }, [source, onBusyChange]);
  async function choose(file: File) {
    setError("");
    setDecoding(true); onBusyChange?.(1);
    try {
      setSource(await imageFromFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally { setDecoding(false); onBusyChange?.(-1); }
  }
  function move(from: number, to: number) {
    setUrls((v) => { const next = [...v]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; });
    onValueChange?.();
  }
  function remove(u: string) {
    if (!window.confirm(t("removeConfirm"))) return;
    setUrls((v) => v.filter((x) => x !== u)); onValueChange?.();
  }
  async function advance() {
    setSource(null);
    setReplacing(null);
    const [next, ...rest] = queue;
    setQueue(rest);
    if (next) await choose(next);
  }
  return (
    <div className="min-w-0 space-y-3 sm:col-span-2" data-testid="photos-field">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label} ({urls.length}/{max})
      </label>
      {urls.map((u) => (
        <input key={u} type="hidden" name="photoUrls" value={u} />
      ))}
      <p className="text-xs text-muted">{t("galleryHint")}</p>
      {urls.length > max && <p role="status" className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted" data-testid="photos-over-limit">{t("overLimit")}</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {urls.map((u, i) => (
          <li key={u} className="min-w-0 space-y-2" data-testid="photo-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u}
              alt=""
              className="aspect-[4/3] w-full rounded-xl border border-line bg-surface-2 object-cover"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className="min-h-11 rounded-xl border border-line px-2 text-xs font-semibold disabled:opacity-40" disabled={i === 0} onClick={() => move(i, i - 1)} data-testid="photo-earlier">{t("moveEarlier")}</button>
              <button type="button" className="min-h-11 rounded-xl border border-line px-2 text-xs font-semibold disabled:opacity-40" disabled={i === urls.length - 1} onClick={() => move(i, i + 1)} data-testid="photo-later">{t("moveLater")}</button>
              <button type="button" className="min-h-11 rounded-xl border border-line px-2 text-xs font-semibold disabled:opacity-40" disabled={!storageReady || busy || decoding || !!source} onClick={() => { setReplacing(i); replaceInput.current?.click(); }} data-testid="photo-replace">{t("replace")}</button>
              <button type="button" className="min-h-11 rounded-xl border border-line px-2 text-xs font-semibold" onClick={() => remove(u)} data-testid="photo-remove">{tb("removeImage")}</button>
            </div>
          </li>
        ))}
      </ul>
      <input
        ref={replaceInput}
        type="file"
        accept={BUSINESS_IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="replace-photo-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choose(f); else setReplacing(null);
          e.target.value = "";
        }}
      />
      <input
        id={id}
        type="file"
        multiple
        accept={BUSINESS_IMAGE_ACCEPT}
        disabled={!storageReady || busy || decoding || !!source || urls.length >= max}
        data-testid="upload-photos"
        className="w-full text-sm file:me-2 file:min-h-12 file:rounded-xl file:border file:border-line file:bg-surface file:px-3"
        onChange={(e) => {
          const [first, ...rest] = Array.from(e.target.files ?? []).slice(
            0,
            max - urls.length,
          );
          setQueue(rest);
          if (first) void choose(first);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted">{t("formats")}</p>
      {source && (
        <BusinessImageEditor
          key={source.url}
          source={source}
          aspect={4 / 3}
          busy={busy}
          onCancel={() => void advance()}
          onConfirm={async (blob) => {
            setBusy(true);
            setError("");
            try {
              const u = await uploadBusinessImage(blob, businessId);
              setUrls((v) => (replacing != null && replacing < v.length ? v.map((x, j) => (j === replacing ? u : x)) : [...v, u])); onValueChange?.();
              await advance();
            } catch (e) {
              setError(e instanceof Error ? e.message : "error");
              throw e;
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
      {!storageReady && (
        <p role="status" className="text-sm text-muted">
          {tb("upload_notConfigured")}
        </p>
      )}
      {error && (
        <p
          role="alert"
          data-testid="upload-photos-state"
          className="text-sm text-brand-text"
        >
          {error === "unsupported" || error === "badType"
            ? t("unsupported")
            : error === "tooLarge"
              ? t("tooLarge")
              : t("retry")}
        </p>
      )}
    </div>
  );
}

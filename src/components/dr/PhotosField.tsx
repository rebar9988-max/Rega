"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BUSINESS_IMAGE_ACCEPT,
  imageFromFile,
  uploadBusinessImage,
} from "@/features/business-images/client";
import { BusinessImageEditor } from "./BusinessImageEditor";
import { UploadSlot, uploadErrorText } from "./BusinessImageField";

/**
 * Gallery photos as fixed slots (promotional images after the cover). Every stored photo stays: an older listing with
 * more photos than slots keeps them all (reorder, replace or remove), and an empty slot appears only below the limit.
 */
export function PhotosField({
  label,
  slotLabel,
  initial,
  max,
  businessId,
  storageReady,
  onBusyChange, onValueChange,
}: {
  label: string;
  /** Name of the n-th photo slot (0-based), e.g. "Promotional image 2". */
  slotLabel: (index: number) => string;
  initial: string[];
  max: number;
  businessId?: string;
  storageReady: boolean;
  onBusyChange?: (delta: number) => void;
  onValueChange?: () => void;
}) {
  const t = useTranslations("businessImages"),
    tb = useTranslations("bizForm"),
    tm = useTranslations("bizForm.media");
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
  function add(files: File[]) {
    const [first, ...rest] = files.slice(0, max - urls.length);
    setQueue(rest);
    if (first) void choose(first);
  }
  const working = busy || decoding || !!source;
  const free = Math.max(0, max - urls.length);
  const iconButton = "grid min-h-11 place-items-center rounded-xl border border-line px-2 text-xs font-semibold hover:border-brand hover:text-brand-text disabled:opacity-40";
  return (
    <fieldset className="min-w-0 space-y-2" data-testid="photos-field">
      <legend className="mb-2 text-sm font-semibold">{label} <span className="font-normal text-muted">({urls.length}/{max})</span></legend>
      {urls.map((u) => (
        <input key={u} type="hidden" name="photoUrls" value={u} />
      ))}
      {urls.length > max && <p role="status" className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted" data-testid="photos-over-limit">{t("overLimit")}</p>}
      <ul className="grid grid-cols-2 gap-3">
        {urls.map((u, i) => (
          <li key={u} className="min-w-0 space-y-2" data-testid="photo-item">
            <p className="text-xs font-semibold text-muted">{slotLabel(i)}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={slotLabel(i)} className="aspect-[4/3] w-full rounded-xl border border-line bg-surface-2 object-cover" />
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" className={iconButton} disabled={!storageReady || working} onClick={() => { setReplacing(i); replaceInput.current?.click(); }} data-testid="photo-replace">{t("replace")}</button>
              <button type="button" className={iconButton} onClick={() => remove(u)} data-testid="photo-remove">{tb("removeImage")}</button>
              {urls.length > 1 && <>
                <button type="button" className={iconButton} disabled={i === 0} onClick={() => move(i, i - 1)} data-testid="photo-earlier" aria-label={`${t("moveEarlier")} – ${slotLabel(i)}`}><span aria-hidden="true" className="rtl-flip">←</span></button>
                <button type="button" className={iconButton} disabled={i === urls.length - 1} onClick={() => move(i, i + 1)} data-testid="photo-later" aria-label={`${t("moveLater")} – ${slotLabel(i)}`}><span aria-hidden="true" className="rtl-flip">→</span></button>
              </>}
            </div>
          </li>
        ))}
        {Array.from({ length: free }, (_, k) => {
          const index = urls.length + k;
          return (
            <li key={`free-${index}`} className="min-w-0 space-y-2">
              <p className="text-xs font-semibold text-muted" id={`photo-slot-${index}`}>{slotLabel(index)}</p>
              <UploadSlot inputId={`photo-input-${index}`} label={tm("addPhoto")} disabled={!storageReady || working} busy={k === 0 && working && replacing === null}
                multiple={k === 0} testId={k === 0 ? "upload-photos" : `upload-photos-${index}`} onFiles={add} />
            </li>
          );
        })}
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
      {error && (
        <p role="alert" data-testid="upload-photos-state" className="text-sm font-semibold text-brand-text">
          {uploadErrorText(error, t, tb)}
        </p>
      )}
    </fieldset>
  );
}

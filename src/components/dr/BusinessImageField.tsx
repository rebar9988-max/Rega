"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BUSINESS_IMAGE_ACCEPT,
  imageFromFile,
  uploadBusinessImage,
} from "@/features/business-images/client";
import { BusinessImageEditor } from "./BusinessImageEditor";

export type BusinessImageProps = {
  name: string;
  label: string;
  /** Text of the empty slot's upload button ("Upload logo", "Add photo 1"). */
  addLabel?: string;
  initial: string;
  businessId?: string;
  storageReady: boolean;
  invalid?: boolean;
  wide?: boolean;
  onBusyChange?: (delta: number) => void;
  onValueChange?: () => void;
};

/** Upload errors as the person reads them (the codes come from features/business-images/client.ts). */
export function uploadErrorText(error: string, t: (key: string) => string, tb: (key: string) => string): string {
  if (error === "notConfigured") return tb("upload_notConfigured");
  if (error === "tooLarge") return t("tooLarge");
  if (error === "unsupported" || error === "badType") return t("unsupported");
  return t("retry");
}

/** The localized "choose a file" card of an empty slot: a real file input (keyboard, screen readers, mobile camera/library) under a styled label, plus drag and drop. */
export function UploadSlot({ inputId, label, disabled, busy, square, onFiles, testId, multiple, invalid }: {
  inputId: string; label: string; disabled: boolean; busy: boolean; square?: boolean; multiple?: boolean; invalid?: boolean;
  onFiles: (files: File[]) => void; testId: string;
}) {
  const tb = useTranslations("bizForm.media");
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { if (disabled) return; e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onFiles(Array.from(e.dataTransfer.files)); }}
      className={`relative ${square ? "aspect-square" : "aspect-[4/3]"} w-full`}
    >
      <input id={inputId} type="file" accept={BUSINESS_IMAGE_ACCEPT} multiple={multiple} disabled={disabled} aria-invalid={invalid} data-testid={testId}
        className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) onFiles(files); }} />
      <span aria-hidden="true"
        className={`pointer-events-none flex size-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-center transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:opacity-50 ${over ? "border-brand bg-brand-soft" : invalid ? "border-brand" : "border-line bg-surface-2 peer-hover:border-brand"}`}>
        {busy
          ? <span className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none" />
          : <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-xl font-bold leading-none text-brand">+</span>}
        <span className="text-sm font-bold text-ink">{busy ? tb("uploading") : label}</span>
        {!busy && <span className="hidden text-xs text-muted sm:block">{tb("dropHere")}</span>}
      </span>
    </div>
  );
}

export function BusinessImageField({
  name,
  label,
  addLabel,
  initial,
  businessId,
  storageReady,
  invalid,
  onBusyChange, onValueChange,
}: BusinessImageProps) {
  const t = useTranslations("businessImages");
  const tb = useTranslations("bizForm");
  const id = useId();
  const replaceInput = useRef<HTMLInputElement>(null);
  const logo = name === "logoUrl";
  const [url, setUrl] = useState(initial);
  const [source, setSource] = useState<Awaited<
    ReturnType<typeof imageFromFile>
  > | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const working = busy || decoding;
  return (
    <div className={`min-w-0 space-y-2 ${logo ? "max-w-44" : ""}`} data-testid={`business-image-${name}`}>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input type="hidden" name={name} value={url} />
      {url && !source ? (
        <figure className="space-y-2">
          <div className={`overflow-hidden rounded-xl border border-line bg-surface-2 ${logo ? "aspect-square" : "aspect-[4/3]"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={t("preview")} className={`size-full ${logo ? "object-contain p-2" : "object-cover"}`} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" disabled={!storageReady || working} onClick={() => replaceInput.current?.click()} data-testid={`replace-${name}`}
              className="min-h-11 rounded-xl border border-line px-2 text-xs font-semibold hover:border-brand hover:text-brand disabled:opacity-50">{t("replace")}</button>
            <button type="button" data-testid={`remove-${name}`}
              onClick={() => { if (!window.confirm(t("removeConfirm"))) return; setUrl(""); onValueChange?.(); }}
              className="min-h-11 rounded-xl border border-line px-2 text-xs font-semibold hover:border-brand hover:text-brand">{tb("removeImage")}</button>
          </div>
          <input id={id} ref={replaceInput} type="file" accept={BUSINESS_IMAGE_ACCEPT} disabled={!storageReady || working} aria-invalid={invalid}
            data-testid={`upload-${name}`} className="sr-only" tabIndex={-1}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void choose(f); }} />
        </figure>
      ) : !source && (
        <UploadSlot inputId={id} label={addLabel ?? label} disabled={!storageReady || working} busy={working} square={logo} invalid={invalid}
          testId={`upload-${name}`} onFiles={([f]) => { if (f) void choose(f); }} />
      )}
      {source && (
        <BusinessImageEditor
          key={source.url}
          source={source}
          logo={logo}
          aspect={logo ? 1 : 16 / 9}
          busy={busy}
          onCancel={() => setSource(null)}
          onConfirm={async (blob) => {
            setBusy(true);
            setError("");
            try {
              const next = await uploadBusinessImage(blob, businessId);
              setUrl(next); onValueChange?.();
              setSource(null);
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
        <p role="alert" data-testid={`upload-${name}-state`} className="text-sm font-semibold text-brand">
          {uploadErrorText(error, t, tb)}
        </p>
      )}
    </div>
  );
}

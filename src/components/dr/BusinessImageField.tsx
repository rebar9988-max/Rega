"use client";
import { useEffect, useId, useState } from "react";
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
  initial: string;
  businessId?: string;
  storageReady: boolean;
  invalid?: boolean;
  wide?: boolean;
  onBusyChange?: (delta: number) => void;
  onValueChange?: () => void;
};
export function BusinessImageField({
  name,
  label,
  initial,
  businessId,
  storageReady,
  invalid,
  onBusyChange, onValueChange,
}: BusinessImageProps) {
  const t = useTranslations("businessImages");
  const tb = useTranslations("bizForm");
  const id = useId();
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
  return (
    <div className="min-w-0 space-y-3" data-testid={`business-image-${name}`}>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <input type="hidden" name={name} value={url} />
      {url && !source && (
        <div className="rounded-xl border border-line bg-surface-2 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={t("preview")}
            className={`${name === "logoUrl" ? "size-28" : "aspect-video w-full"} rounded-lg object-contain`}
          />
        </div>
      )}
      <input
        id={id}
        type="file"
        accept={BUSINESS_IMAGE_ACCEPT}
        disabled={!storageReady || busy || decoding}
        aria-invalid={invalid}
        data-testid={`upload-${name}`}
        className="w-full min-w-0 text-sm file:me-2 file:min-h-12 file:rounded-xl file:border file:border-line file:bg-surface file:px-3 file:font-semibold"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choose(f);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-muted">{t("formats")}</p>
      {source && (
        <BusinessImageEditor
          key={source.url}
          source={source}
          logo={name === "logoUrl"}
          aspect={name === "logoUrl" ? 1 : 16 / 9}
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
      {url && !source && (
        <button
          type="button"
          onClick={() => { setUrl(""); onValueChange?.(); }}
          className="min-h-12 rounded-xl border border-line px-3 text-sm font-semibold"
        >
          {tb("removeImage")}
        </button>
      )}
      {!storageReady && (
        <p role="status" className="text-sm text-muted">
          {tb("upload_notConfigured")}
        </p>
      )}
      {error && (
        <p
          role="alert"
          data-testid={`upload-${name}-state`}
          className="text-sm font-semibold text-brand"
        >
          {error === "notConfigured"
            ? tb("upload_notConfigured")
            : error === "tooLarge"
              ? t("tooLarge")
              : error === "unsupported" || error === "badType"
                ? t("unsupported")
                : t("retry")}
        </p>
      )}
    </div>
  );
}

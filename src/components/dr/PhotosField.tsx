"use client";
import { useEffect, useId, useState } from "react";
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
  async function advance() {
    setSource(null);
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
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {urls.map((u) => (
          <li key={u} className="min-w-0 space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={u}
              alt=""
              className="aspect-[4/3] w-full rounded-xl border border-line bg-surface-2 object-contain"
            />
            <button
              type="button"
              className="min-h-12 w-full rounded-xl border border-line px-3 text-sm"
              onClick={() => { setUrls((v) => v.filter((x) => x !== u)); onValueChange?.(); }}
            >
              {tb("removeImage")}
            </button>
          </li>
        ))}
      </ul>
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
          aspect={source.image.naturalWidth / source.image.naturalHeight}
          busy={busy}
          onCancel={() => void advance()}
          onConfirm={async (blob) => {
            setBusy(true);
            setError("");
            try {
              const u = await uploadBusinessImage(blob, businessId);
              setUrls((v) => [...v, u]); onValueChange?.();
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
          className="text-sm text-brand"
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

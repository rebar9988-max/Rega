"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { canvasBlob } from "@/features/business-images/client";
import {
  cropGeometry,
  RESET_CROP,
  type Crop,
} from "@/features/business-images/crop";

type Source = { image: HTMLImageElement; url: string };
export function BusinessImageEditor({
  source,
  aspect,
  logo,
  busy,
  onConfirm,
  onCancel,
}: {
  source: Source;
  aspect: number;
  logo?: boolean;
  busy: boolean;
  onConfirm: (blob: Blob) => Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations("businessImages");
  const [crop, setCrop] = useState<Crop>(RESET_CROP);
  const [error, setError] = useState(false);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const zoom = (event: WheelEvent) => {
      if (!event.ctrlKey || busy) return;
      event.preventDefault();
      setCrop((c) => ({
        ...c,
        zoom: Math.min(5, Math.max(1, c.zoom - event.deltaY * 0.01)),
      }));
    };
    node.addEventListener("wheel", zoom, { passive: false });
    return () => node.removeEventListener("wheel", zoom);
  }, [busy]);
  const geometry = cropGeometry(
    source.image.naturalWidth,
    source.image.naturalHeight,
    aspect,
    crop,
  );
  const button =
    "min-h-12 rounded-xl border border-line px-4 text-sm font-semibold disabled:opacity-50 hover:border-brand";
  // Buttons move from the clamped position (like dragging), so a press at the edge never piles up hidden offset.
  function nudge(dx: number, dy: number) {
    setCrop((c) => {
      const g = cropGeometry(source.image.naturalWidth, source.image.naturalHeight, aspect, c);
      return { zoom: c.zoom, x: g.left + (g.width - 1) / 2 + dx, y: g.top + (g.height - 1 / aspect) / 2 + dy };
    });
  }
  const zoomBy = (factor: number) => setCrop((c) => ({ ...c, zoom: Math.min(5, Math.max(1, c.zoom * factor)) }));
  const tool = "grid size-11 place-items-center rounded-xl border border-line bg-surface text-lg font-semibold hover:border-brand hover:text-brand-text disabled:opacity-50";
  async function confirm() {
    setError(false);
    try {
      const canvas = document.createElement("canvas");
      const width = Math.max(
        1,
        Math.floor(
          Math.min(
            logo ? 512 : 1280,
            8192 * aspect,
            Math.sqrt(1_600_000 * aspect),
          ),
        ),
      );
      canvas.width = width;
      canvas.height = Math.max(1, Math.floor(width / aspect));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      if (!logo) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(
        source.image,
        geometry.left * width,
        geometry.top * width,
        geometry.width * width,
        geometry.height * width,
      );
      await onConfirm(
        await canvasBlob(canvas, logo ? "image/png" : "image/jpeg"),
      );
    } catch {
      setError(true);
    }
  }
  return (
    <fieldset
      disabled={busy}
      className="space-y-3 rounded-xl border border-line bg-surface p-3"
      data-testid="image-editor"
    >
      <legend className="px-1 text-sm font-bold">{t("title")}</legend>
      <p className="text-sm text-muted">{t("hint")}</p>
      <div
        ref={frame}
        role="img"
        aria-label={t("preview")}
        tabIndex={0}
        data-testid="crop-preview"
        className="relative mx-auto w-full max-w-sm touch-none overflow-hidden rounded-xl border border-line bg-surface-2 outline-offset-4 focus-visible:outline-2 focus-visible:outline-brand"
        style={{ aspectRatio: aspect }}
        onKeyDown={(e) => {
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [-0.02, 0],
            ArrowRight: [0.02, 0],
            ArrowUp: [0, -0.02],
            ArrowDown: [0, 0.02],
          };
          if (moves[e.key] && !busy) {
            e.preventDefault();
            const [x, y] = moves[e.key];
            setCrop((c) => ({ ...c, x: c.x + x, y: c.y + y }));
          }
        }}
        onPointerDown={(e) => {
          if (busy || points.current.size >= 2) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }}
        onPointerMove={(e) => {
          const previous = points.current.get(e.pointerId);
          if (!previous || busy || !frame.current) return;
          const before = [...points.current.values()];
          points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const after = [...points.current.values()];
          const width = frame.current.getBoundingClientRect().width;
          const distance = (p: typeof before) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
          const pinching = before.length === 2;
          const ratio = pinching && distance(before) > 1 ? distance(after) / distance(before) : 1;
          setCrop((c) => {
            const g = cropGeometry(source.image.naturalWidth, source.image.naturalHeight, aspect, c);
            return { zoom: Math.min(5, Math.max(1, c.zoom * ratio)),
              x: g.left + (g.width - 1) / 2 + (e.clientX - previous.x) / width / (pinching ? 2 : 1),
              y: g.top + (g.height - 1 / aspect) / 2 + (e.clientY - previous.y) / width / (pinching ? 2 : 1) };
          });
        }}
        onPointerUp={(e) => points.current.delete(e.pointerId)}
        onPointerCancel={(e) => points.current.delete(e.pointerId)}
        onLostPointerCapture={(e) => points.current.delete(e.pointerId)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={source.url}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            width: `${geometry.width * 100}%`,
            height: `${geometry.height * aspect * 100}%`,
            left: `${geometry.left * 100}%`,
            top: `${geometry.top * aspect * 100}%`,
          }}
        />
      </div>
      {logo && (
        // The logo exactly as the profile shows it (same crop, profile avatar size and corners).
        <div className="flex items-center justify-center gap-3" data-testid="logo-profile-preview">
          <div className="relative size-16 overflow-hidden rounded-xl border border-line bg-surface shadow-card" role="img" aria-label={t("preview")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={source.url} alt="" draggable={false} className="pointer-events-none absolute max-w-none select-none"
              style={{ width: `${geometry.width * 100}%`, height: `${geometry.height * aspect * 100}%`, left: `${geometry.left * 100}%`, top: `${geometry.top * aspect * 100}%` }} />
          </div>
        </div>
      )}
      <label className="flex flex-col gap-2 text-sm font-semibold">
        {t("zoom")}
        <input
          type="range"
          min="1"
          max="5"
          step="0.01"
          value={crop.zoom}
          dir="ltr"
          onChange={(e) =>
            setCrop((c) => ({ ...c, zoom: Number(e.target.value) }))
          }
          className="min-h-12 w-full accent-brand-control"
        />
      </label>
      {/* Image space is physical (left is left), whatever the page direction. */}
      <div dir="ltr" className="flex flex-wrap items-center justify-center gap-2" data-testid="crop-controls">
        <button type="button" className={tool} aria-label={t("moveLeft")} onClick={() => nudge(-0.04, 0)}><span aria-hidden="true">←</span></button>
        <button type="button" className={tool} aria-label={t("moveUp")} onClick={() => nudge(0, -0.04)}><span aria-hidden="true">↑</span></button>
        <button type="button" className={tool} aria-label={t("moveDown")} onClick={() => nudge(0, 0.04)}><span aria-hidden="true">↓</span></button>
        <button type="button" className={tool} aria-label={t("moveRight")} onClick={() => nudge(0.04, 0)}><span aria-hidden="true">→</span></button>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
        <button type="button" className={tool} aria-label={t("zoomOut")} onClick={() => zoomBy(1 / 1.15)} data-testid="crop-zoom-out"><span aria-hidden="true">−</span></button>
        <button type="button" className={tool} aria-label={t("zoomIn")} onClick={() => zoomBy(1.15)} data-testid="crop-zoom-in"><span aria-hidden="true">+</span></button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={button}
          onClick={() => setCrop(RESET_CROP)}
        >
          {t("reset")}
        </button>
        <button type="button" className={button} onClick={onCancel}>
          {t("cancel")}
        </button>
        <button
          type="button"
          className="min-h-12 rounded-xl bg-brand px-4 text-sm font-bold text-brand-ink disabled:opacity-50"
          onClick={() => void confirm()}
        >
          {busy ? t("saving") : t("confirm")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-brand-text">
          {t("retry")}
        </p>
      )}
    </fieldset>
  );
}

import type { ReactNode } from "react";
import type { Localized as LocalizedValue } from "@/lib/content";

/**
 * Renders user-generated text with the right lang/dir.
 * `lang`/`dir` are only emitted when they matter, keeping the DOM clean.
 * <bdi> isolates the text so it can never reorder neighbouring punctuation or numbers.
 */
export function Text({ value, pageLang, className }: { value: LocalizedValue; pageLang: string; className?: string }) {
  const lang = value.lang && value.lang !== pageLang ? value.lang : undefined;
  return (
    <bdi lang={lang} dir={value.dir === "auto" ? "auto" : lang ? value.dir : undefined} className={className}>
      {value.text}
    </bdi>
  );
}

/** Always-LTR island for phone numbers, e-mails, URLs, postal codes and Latin addresses inside RTL text. */
export function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={`inline-block text-start ${className ?? ""}`}>
      {children}
    </bdi>
  );
}

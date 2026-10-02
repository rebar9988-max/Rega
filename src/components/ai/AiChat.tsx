"use client";

import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import { LOCALES } from "@/i18n/locales";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const KEY = "rega-ai-session";
let memoryId: string | null = null;

function sessionId() {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(KEY, id); }
    return id;
  } catch {
    memoryId ??= crypto.randomUUID();
    return memoryId;
  }
}

function resetSession() {
  try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  memoryId = null;
}

/** REGA links in an answer (e.g. /ckb/businesses/zagros) become in-app links; everything else stays plain text. */
const LINK_RE = new RegExp(`(/(?:${LOCALES.join("|")})/(?:businesses|services)/[\\w\\-\\u0600-\\u06FF%]+(?:/[\\w\\-\\u0600-\\u06FF%]+)?)`, "g");
function withLinks(text: string) {
  return text.split(LINK_RE).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    const [, locale, ...rest] = part.split("/");
    return <Link key={i} href={`/${rest.join("/")}`} locale={locale as (typeof LOCALES)[number]} className="font-semibold text-brand underline" dir="ltr">{part}</Link>;
  });
}

export function AiChat() {
  const t = useTranslations("ai");
  const locale = useLocale();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const suggestions = [t("suggestion1"), t("suggestion2"), t("suggestion3")];

  useEffect(() => { end.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [messages, busy]);

  // Continue this browser session's conversation after a reload (stored on the server, nothing in localStorage).
  useEffect(() => {
    let cancelled = false;
    let id: string | null = null;
    try { id = sessionStorage.getItem(KEY); } catch { id = null; }
    if (!id) return;
    fetch(`/api/v1/ai/chat?sessionId=${encodeURIComponent(id)}`, { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (!cancelled && body?.ok && Array.isArray(body.data.messages) && body.data.messages.length) setMessages((m) => (m.length ? m : body.data.messages)); })
      .catch(() => { /* history is a convenience; the chat works without it */ });
    return () => { cancelled = true; };
  }, []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next); setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.filter((m) => !m.error).slice(-20).map(({ role, content }) => ({ role, content })),
          locale, sessionId: sessionId(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const msg = res.status === 503 ? t("notConfigured") : res.status === 429 ? t("rateLimited") : t("error");
        setMessages([...next, { role: "assistant", content: msg, error: true }]);
      } else {
        setMessages([...next, { role: "assistant", content: json.data.content }]);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: t("error"), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div role="log" aria-live="polite" aria-label={t("title")} className="flex min-h-[45dvh] flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        {messages.length === 0 && (
          <div className="m-auto text-center">
            <p className="mb-4 text-muted">{t("subtitle")}</p>
            <ul className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <li key={s}><button type="button" onClick={() => send(s)} className="min-h-10 rounded-full border border-line bg-surface-2 px-4 text-sm hover:border-brand">{s}</button></li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "self-end bg-brand text-brand-ink" : m.error ? "self-start border border-line bg-surface-2 text-muted" : "self-start bg-surface-2"}`}>
            {/* dir=auto: the model may answer in a different script than the UI language. */}
            <bdi dir="auto">{m.role === "assistant" && !m.error ? withLinks(m.content) : m.content}</bdi>
          </div>
        ))}
        {busy && <div className="self-start rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted" role="status">{t("thinking")}</div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex gap-2">
        <label htmlFor="ai-input" className="sr-only">{t("placeholder")}</label>
        <input id="ai-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={4000} dir="auto" placeholder={t("placeholder")} autoComplete="off"
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-base outline-none focus:border-brand" />
        <button type="submit" disabled={busy || !input.trim()} className="min-h-12 rounded-xl bg-brand px-6 text-sm font-semibold text-brand-ink hover:bg-brand-hover disabled:opacity-50">{t("send")}</button>
      </form>
      <div className="flex flex-wrap items-center justify-center gap-3 text-center text-xs text-muted">
        <p>{t("disclaimer")}</p>
        {messages.length > 0 && <button type="button" onClick={() => { resetSession(); setMessages([]); }} disabled={busy} className="min-h-9 rounded-lg border border-line px-3 font-semibold hover:border-brand hover:text-brand disabled:opacity-50" data-testid="ai-new-chat">{t("newChat")}</button>}
      </div>
    </div>
  );
}

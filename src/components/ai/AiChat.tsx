"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

function sessionId() {
  try {
    let id = sessionStorage.getItem("rega-ai-session");
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("rega-ai-session", id); }
    return id;
  } catch {
    return crypto.randomUUID();
  }
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
            <bdi dir="auto">{m.content}</bdi>
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
      <p className="text-center text-xs text-muted">{t("disclaimer")}</p>
    </div>
  );
}

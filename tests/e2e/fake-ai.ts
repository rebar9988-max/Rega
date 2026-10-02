/** Local stand-in for every AI provider (and Nominatim) so E2E never touches real services or needs real keys. */
import { createServer, type Server } from "node:http";

export const FAKE_GROK_ANSWER = "Antwort von Grok (fake)";
export const FAKE_GROQ_ANSWER = "Antwort von Groq (fake)";
export const FAKE_OPENAI_ANSWER = "Antwort von OpenAI (fake)";
export const FAKE_DEEPSEEK_ANSWER = "Antwort von DeepSeek (fake)";
export const FAKE_OPENROUTER_ANSWER = "Antwort von OpenRouter (fake)";
export const FAKE_ANTHROPIC_ANSWER = "Antwort von Claude (fake)";

export function startFakeAi(port = 3999): Promise<Server> {
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const json = (status: number, body: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
      // FORCE_DIRECT_REJECT: OpenAI, Grok and Groq reject the request with 400. The gateway falls back, but a 400 says
      // nothing about provider health, so it never opens a circuit and cannot disturb the other tests.
      if (/^\/(openai|grok|groq)\/chat\/completions$/.test(req.url ?? "") && raw.includes("FORCE_DIRECT_REJECT")) return json(400, { error: "rejected (fake)" });
      // FORCE_OPENROUTER_REJECT: OpenRouter rejects with 400 (falls back without affecting provider health).
      if (req.url === "/openrouter/chat/completions" && raw.includes("FORCE_OPENROUTER_REJECT")) return json(400, { error: "rejected (fake)" });
      if (req.url === "/groq/chat/completions" && raw.includes("FORCE_GROQ_FAIL")) return json(500, { error: "groq is down (fake)" });
      if (req.url === "/groq/chat/completions" && req.headers.authorization === "Bearer e2e-fake-groq-key") {
        return json(200, { choices: [{ message: { content: FAKE_GROQ_ANSWER } }], usage: { prompt_tokens: 3, completion_tokens: 3 } });
      }
      if (req.url === "/deepseek/chat/completions" && raw.includes("FORCE_DEEPSEEK_FAIL")) return json(402, { error: { message: "Insufficient Balance (fake)" } });
      if (req.url === "/deepseek/chat/completions" && req.headers.authorization === "Bearer e2e-fake-deepseek-key") {
        return json(200, { choices: [{ message: { content: FAKE_DEEPSEEK_ANSWER } }], usage: { prompt_tokens: 2, completion_tokens: 2 } });
      }
      // OpenRouter: the public attribution headers must be present, as in production.
      if (req.url === "/openrouter/chat/completions" && req.headers.authorization === "Bearer e2e-fake-openrouter-key" && req.headers["x-title"] === "REGA Platform" && req.headers["http-referer"]) {
        return json(200, { choices: [{ message: { content: FAKE_OPENROUTER_ANSWER } }], usage: { prompt_tokens: 2, completion_tokens: 2 } });
      }
      if (req.url?.startsWith("/gemini/") && raw.includes("ping")) return json(200, { candidates: [{ content: { parts: [{ text: "ok" }] } }] }); // health probe only
      if (req.url?.startsWith("/gemini/")) return json(503, { error: "gemini is down (fake)" }); // chat traffic: forces the fallback path
      if (req.url === "/openai/chat/completions" && raw.includes("FORCE_OPENAI_FAIL")) return json(500, { error: "openai is down (fake)" });
      // An empty answer: the gateway falls back, but (unlike a 5xx) it does not count against OpenAI's circuit breaker.
      if (req.url === "/openai/chat/completions" && raw.includes("FORCE_OPENAI_EMPTY")) return json(200, { choices: [{ message: { content: "" }, finish_reason: "stop" }] });
      if (req.url === "/openai/chat/completions" && req.headers.authorization === "Bearer e2e-fake-openai-key") {
        const body = JSON.parse(raw || "{}");
        // ECHO_CONTEXT: answer with the system prompt, so tests can check what REGA retrieved from the database.
        if (raw.includes("ECHO_CONTEXT")) {
          const system = (body.messages ?? []).find((m: { role: string }) => m.role === "system" || m.role === "developer");
          return json(200, { choices: [{ message: { content: String(system?.content ?? "") } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
        }
        // OpenAI-specific request shape must be respected (no custom temperature, max_completion_tokens).
        if ("temperature" in body || "max_tokens" in body || !("max_completion_tokens" in body)) return json(400, { error: "bad shape (fake)" });
        return json(200, { choices: [{ message: { content: FAKE_OPENAI_ANSWER } }], usage: { prompt_tokens: 4, completion_tokens: 4 } });
      }
      if (req.url === "/grok/chat/completions" && raw.includes("FORCE_GROK_FAIL")) return json(500, { error: "grok is down (fake)" });
      if (req.url === "/grok/chat/completions" && req.headers.authorization === "Bearer e2e-fake-xai-key") {
        return json(200, { choices: [{ message: { content: FAKE_GROK_ANSWER } }], usage: { prompt_tokens: 4, completion_tokens: 4 } });
      }
      if (req.url === "/anthropic/messages" && req.headers["x-api-key"] === "e2e-fake-anthropic-key") {
        const body = JSON.parse(raw || "{}");
        const messages = (body.messages ?? []) as { role: string }[];
        // Messages API shape must be respected: version header, top-level system, max_tokens, no custom temperature,
        // only user/assistant turns, ending on a user turn (newer Claude models reject prefill).
        const valid = req.headers["anthropic-version"] === "2023-06-01" && typeof body.system === "string" && Number.isInteger(body.max_tokens) &&
          !("temperature" in body) && messages.length > 0 && messages.every((m) => m.role === "user" || m.role === "assistant") && messages.at(-1)?.role === "user";
        if (!valid) return json(400, { type: "error", error: { type: "invalid_request_error", message: "bad shape (fake)" } });
        const text = raw.includes("ping") && !raw.includes("FORCE_") ? "ok" : FAKE_ANTHROPIC_ANSWER;
        return json(200, { type: "message", role: "assistant", content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 5, output_tokens: 5 } });
      }
      // Fake Nominatim (GEOCODING_URL=http://127.0.0.1:3999/geocode): a few known addresses, nothing else.
      if (req.url?.startsWith("/geocode/search")) {
        const q = new URL(req.url, "http://x").searchParams;
        if (!/python|node|REGA Platform/i.test(String(req.headers["user-agent"]))) return json(403, { error: "user agent required" });
        const street = q.get("street") ?? "";
        const city = (q.get("city") ?? "").toLowerCase();
        if (!street) {
          const centres: Record<string, [string, string]> = { berlin: ["52.5170365", "13.3888599"], hamburg: ["53.550341", "10.000654"] };
          const c = centres[city];
          return json(200, c ? [{ lat: c[0], lon: c[1], addresstype: "city", display_name: city }] : []);
        }
        if (/^Oranienstra(ß|ss)e 1$/i.test(street) && city === "berlin") return json(200, [
          { lat: "52.5022381", lon: "13.4180123", addresstype: "building", display_name: "1, Oranienstraße, Kreuzberg, 10999 Berlin, Deutschland" },
          { lat: "52.5019", lon: "13.4176", addresstype: "road", display_name: "Oranienstraße, Kreuzberg, Berlin" },
        ]);
        if (/^Jungfernstieg 1$/i.test(street) && city === "hamburg") return json(200, [
          { lat: "53.5530129", lon: "9.9925377", addresstype: "building", display_name: "1, Jungfernstieg, 20354 Hamburg, Deutschland" },
        ]);
        return json(200, []);
      }
      json(404, { error: "not found" });
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

/** Local stand-in for Gemini and xAI so E2E never touches real providers or needs real keys. */
import { createServer, type Server } from "node:http";

export const FAKE_GROK_ANSWER = "Antwort von Grok (fake)";
export const FAKE_GROQ_ANSWER = "Antwort von Groq (fake)";
export const FAKE_OPENAI_ANSWER = "Antwort von OpenAI (fake)";

export function startFakeAi(port = 3999): Promise<Server> {
  const server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const json = (status: number, body: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
      if (req.url === "/groq/chat/completions" && req.headers.authorization === "Bearer e2e-fake-groq-key") {
        return json(200, { choices: [{ message: { content: FAKE_GROQ_ANSWER } }], usage: { prompt_tokens: 3, completion_tokens: 3 } });
      }
      if (req.url?.startsWith("/gemini/") && raw.includes("ping")) return json(200, { candidates: [{ content: { parts: [{ text: "ok" }] } }] }); // health probe only
      if (req.url?.startsWith("/gemini/")) return json(503, { error: "gemini is down (fake)" }); // chat traffic: forces the fallback path
      if (req.url === "/openai/chat/completions" && raw.includes("FORCE_OPENAI_FAIL")) return json(500, { error: "openai is down (fake)" });
      if (req.url === "/openai/chat/completions" && req.headers.authorization === "Bearer e2e-fake-openai-key") {
        const body = JSON.parse(raw || "{}");
        // OpenAI-specific request shape must be respected (no custom temperature, max_completion_tokens).
        if ("temperature" in body || "max_tokens" in body || !("max_completion_tokens" in body)) return json(400, { error: "bad shape (fake)" });
        return json(200, { choices: [{ message: { content: FAKE_OPENAI_ANSWER } }], usage: { prompt_tokens: 4, completion_tokens: 4 } });
      }
      if (req.url === "/grok/chat/completions" && raw.includes("FORCE_GROK_FAIL")) return json(500, { error: "grok is down (fake)" });
      if (req.url === "/grok/chat/completions" && req.headers.authorization === "Bearer e2e-fake-xai-key") {
        return json(200, { choices: [{ message: { content: FAKE_GROK_ANSWER } }], usage: { prompt_tokens: 4, completion_tokens: 4 } });
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

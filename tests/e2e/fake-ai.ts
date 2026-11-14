/** Local stand-in for every (zero-cost) AI provider (and Nominatim) so E2E never touches real services or needs real keys. */
import { createServer, type Server } from "node:http";

export const FAKE_GROQ_ANSWER = "Antwort von Groq (fake)";
export const FAKE_OPENROUTER_ANSWER = "Antwort von OpenRouter (fake)";

export function startFakeAi(port = 3999): Promise<Server> {
  const objects = new Map<string, { bytes: Buffer; mime: string }>();
  const server = createServer((req, res) => {
    // Existing test server stores normalized files locally, so public cards load the real saved bytes.
    if (req.url?.startsWith("/storage/")) {
      const key = new URL(req.url, "http://localhost").pathname;
      if (req.method === "GET") {
        const object = objects.get(key);
        res.writeHead(object ? 200 : 404, {"content-type":object?.mime ?? "text/plain","cache-control":"no-store"});
        res.end(object?.bytes); return;
      }
      if (req.method === "DELETE") { objects.delete(key);res.writeHead(200);res.end();return; }
      if (req.method === "PUT") {
        const chunks: Buffer[] = [];
        req.on("data", c => chunks.push(c));
        req.on("end", () => { objects.set(key,{bytes:Buffer.concat(chunks),mime:String(req.headers["content-type"] ?? "application/octet-stream")});res.writeHead(200,{etag:'"test-object"'});res.end(); });
        return;
      }
    }
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      const json = (status: number, body: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
      // Only the zero-cost providers exist (gemini, groq, openrouter; Workers AI needs AI_SERVICE_URL, unset in E2E).
      // FORCE_DIRECT_REJECT: Groq rejects with 400. The gateway falls back, but a 400 says nothing about provider health,
      // so it never opens a circuit and cannot disturb the other tests.
      if (req.url === "/groq/chat/completions" && raw.includes("FORCE_DIRECT_REJECT")) return json(400, { error: "rejected (fake)" });
      // FORCE_OPENROUTER_REJECT: OpenRouter rejects with 400 (falls back without affecting provider health).
      if (req.url === "/openrouter/chat/completions" && raw.includes("FORCE_OPENROUTER_REJECT")) return json(400, { error: "rejected (fake)" });
      if (req.url === "/groq/chat/completions" && req.headers.authorization === "Bearer e2e-fake-groq-key") {
        const body = JSON.parse(raw || "{}");
        // The default Groq model (openai/gpt-oss-120b) is a reasoning model: the runtime must ask for low effort.
        if (body.reasoning_effort !== "low") return json(400, { error: "missing reasoning_effort (fake)" });
        // ECHO_CONTEXT: answer with the system prompt, so tests can check what REGA retrieved from the database.
        if (raw.includes("ECHO_CONTEXT")) {
          const system = (body.messages ?? []).find((m: { role: string }) => m.role === "system");
          return json(200, { choices: [{ message: { content: String(system?.content ?? "") } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
        }
        return json(200, { choices: [{ message: { content: FAKE_GROQ_ANSWER } }], usage: { prompt_tokens: 3, completion_tokens: 3 } });
      }
      // OpenRouter: the public attribution headers and a verified `:free` model must be present, as in production.
      if (req.url === "/openrouter/chat/completions" && req.headers.authorization === "Bearer e2e-fake-openrouter-key" && req.headers["x-title"] === "REGA Platform" && req.headers["http-referer"]) {
        if (!String(JSON.parse(raw || "{}").model ?? "").endsWith(":free")) return json(400, { error: "only :free models (fake)" });
        return json(200, { choices: [{ message: { content: FAKE_OPENROUTER_ANSWER } }], usage: { prompt_tokens: 2, completion_tokens: 2 } });
      }
      if (req.url?.startsWith("/gemini/") && raw.includes("ping")) return json(200, { candidates: [{ content: { parts: [{ text: "ok" }] } }] }); // health probe only
      if (req.url?.startsWith("/gemini/")) return json(503, { error: "gemini is down (fake)" }); // chat traffic: forces the fallback path
      // Fake Nominatim (GEOCODING_URL=http://127.0.0.1:3999/geocode): a few known addresses, nothing else.
      if (req.url?.startsWith("/geocode/search")) {
        const q = new URL(req.url, "http://x").searchParams;
        if (!/python|node|REGA Platform/i.test(String(req.headers["user-agent"]))) return json(403, { error: "user agent required" });
        const street = q.get("street") ?? "";
        const postal = q.get("postalcode") ?? "";
        // A postal code alone names its area; with a street it stands in for a missing or misspelled city.
        const areas: Record<string, { city: string; lat: string; lon: string }> = {
          "10999": { city: "Berlin", lat: "52.4996", lon: "13.4213" },
          "51465": { city: "Bergisch Gladbach", lat: "50.9918", lon: "7.1363" },
        };
        if (!street && !q.get("city") && !q.get("q")) {
          const a = areas[postal];
          return json(200, a ? [{ lat: a.lat, lon: a.lon, addresstype: "postcode", display_name: `${postal}, ${a.city}, Deutschland`, address: { postcode: postal, city: a.city, country_code: "de" } }] : []);
        }
        if (/^Johann-Wilhelm-Lindlar-Stra(ß|ss)e 8$/i.test(street) && postal === "51465" && !q.get("city")) return json(200, [
          { lat: "50.9912345", lon: "7.1298765", addresstype: "building", display_name: "8, Johann-Wilhelm-Lindlar-Straße, 51465 Bergisch Gladbach, Deutschland" },
        ]);
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

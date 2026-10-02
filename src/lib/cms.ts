/**
 * CMS pages: parsing of the page body (pure) and loading of a published page for a locale (server).
 *
 * Body syntax (kept deliberately small, safe by construction: it only ever produces React text, never HTML):
 *   blank line   -> new paragraph        "## Heading" -> heading        "- item" lines -> bullet list
 */
export type CmsBlock = { type: "h2"; text: string } | { type: "p"; text: string } | { type: "ul"; items: string[] };

export function parseCmsBody(body: string): CmsBlock[] {
  const blocks: CmsBlock[] = [];
  for (const chunk of body.replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
    if (lines.length === 0) continue;
    let list: string[] = [];
    let para: string[] = [];
    const flushList = () => { if (list.length) blocks.push({ type: "ul", items: list }); list = []; };
    const flushPara = () => { if (para.length) blocks.push({ type: "p", text: para.join(" ") }); para = []; };
    for (const line of lines) {
      const h = /^##\s+(.+)$/.exec(line.trim());
      const li = /^[-*]\s+(.+)$/.exec(line.trim());
      if (h) { flushPara(); flushList(); blocks.push({ type: "h2", text: h[1] }); }
      else if (li) { flushPara(); list.push(li[1]); }
      else { flushList(); para.push(line.trim()); }
    }
    flushPara(); flushList();
  }
  return blocks;
}

export const PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

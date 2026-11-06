import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import middleware from "../src/middleware";

for (const language of ["", "en-US,en;q=0.9", "de-DE,de;q=0.9"]) {
  for (const saved of ["", "invalid", "en", "de", "ckb"]) {
    test(`root: browser=${language}, saved=${saved}`, async () => {
      const request = new NextRequest("https://www.rega24.com/?source=test", {
        headers: { "accept-language": language, cookie: `NEXT_LOCALE=${saved}` },
      });
      const response = await middleware(request);
      const expected = ["en", "de", "ckb"].includes(saved) ? saved : "ckb";
      assert.equal(response.headers.get("location"), `https://www.rega24.com/${expected}?source=test`);
      assert.equal(response.status, 307);
      assert.equal(request.headers.get("accept-language"), language);
      assert.equal(response.cookies.get("REGA_LOCALE"), undefined);
    });
  }
}
for (const locale of ["en", "de", "ckb"]) {
  test(`explicit /${locale} wins and persists`, async () => {
    const response = await middleware(new NextRequest(`https://www.rega24.com/${locale}`, {
      headers: { "accept-language": "de", cookie: "NEXT_LOCALE=fr" },
    }));
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("x-middleware-request-x-next-intl-locale"), locale);
    assert.equal(response.cookies.get("NEXT_LOCALE")?.value, locale);
    assert.equal(response.cookies.get("REGA_LOCALE")?.value, locale);
  });
}

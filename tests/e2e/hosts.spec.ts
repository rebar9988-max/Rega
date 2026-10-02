import { expect, test } from "@playwright/test";

// Regression: the apex→www rule once matched www too, so every www URL redirected to itself (production outage).
const get = (request: import("@playwright/test").APIRequestContext, host: string, path: string) =>
  request.get(path, { headers: { host }, maxRedirects: 0 });

test("canonical host (www) is served directly, never redirected to itself", async ({ request }) => {
  for (const path of ["/ckb", "/de/businesses", "/robots.txt", "/sitemap.xml", "/api/v1/health"]) {
    const res = await get(request, "www.regaplatform.com", path);
    expect(res.status(), `${path} on www`).toBe(200);
    expect(res.headers()["location"]).toBeUndefined();
  }
});

test("apex host redirects permanently to www, preserving path and query", async ({ request }) => {
  const cases: [string, string][] = [
    ["/", "https://www.regaplatform.com/"],
    ["/ckb", "https://www.regaplatform.com/ckb"],
    ["/de/businesses?q=zagros", "https://www.regaplatform.com/de/businesses?q=zagros"],
  ];
  for (const [path, location] of cases) {
    const res = await get(request, "regaplatform.com", path);
    expect(res.status(), path).toBe(301);
    expect(res.headers()["location"], path).toBe(location);
  }
});

test("look-alike hosts are not treated as the apex", async ({ request }) => {
  for (const host of ["xregaplatform.com", "regaplatform.com.evil.example"]) {
    const res = await get(request, host, "/ckb");
    expect(res.headers()["location"] ?? "").not.toContain("www.regaplatform.com");
  }
});

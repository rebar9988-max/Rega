import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { BUSINESS_SOCIAL_PLATFORMS, BUSINESS_SOCIAL_FIELDS, normalizeBusinessSocialUrl } from "../src/lib/business-social";
import { businessSocialSchemas } from "../src/lib/business-social-schema";
import { businessCreateSchema, businessUpdateSchema } from "../src/lib/validation";

const accounts = {
  facebook: "https://www.facebook.com/Business.Name",
  instagram: "https://www.instagram.com/business.name/",
  tiktok: "https://www.tiktok.com/@business.name",
  snapchat: "https://www.snapchat.com/add/business.name",
};
for (const platform of BUSINESS_SOCIAL_PLATFORMS) {
  test(`${platform}: valid account survives normalization; whitespace and tracking are safe`, () => {
    assert.deepEqual(normalizeBusinessSocialUrl(platform, accounts[platform]), { ok: true, value: accounts[platform] });
    assert.deepEqual(normalizeBusinessSocialUrl(platform, `  ${accounts[platform]}?utm_source=share#profile  `), { ok: true, value: accounts[platform] });
    assert.deepEqual(normalizeBusinessSocialUrl(platform, " \t\n "), { ok: true, value: null });
    assert.deepEqual(normalizeBusinessSocialUrl(platform, null), { ok: true, value: null });
  });
  test(`${platform}: scheme, hostname, userinfo and length attacks fail closed`, () => {
    const domain = `${platform}.com`;
    for (const input of [
      "not a URL", "javascript:alert(1)", "data:text/html,x", accounts[platform].replace("https:", "http:"),
      accounts[platform].replace(domain, `${domain}.evil.example`),
      accounts[platform].replace(domain, `evil${domain}`),
      accounts[platform].replace(domain, `${domain}.`),
      accounts[platform].replace("www.", "evil."),
      `https://${domain}@evil.example/account`, `https://evil.example@${domain}/account`,
      `https://user:password@${domain}/account`, `https://${domain}:444/account`,
      `https://${domain}`, `https://${domain}/`, `https://${domain}/?account=business`,
      `https://${domain}/${"x".repeat(501)}`, `https://${domain}/business\\account`,
      `https://${domain}/busin\ness`, `https://${domain}/%2faccount`,
      `https://${domain}/foo/../account`, undefined, {}, 123,
    ]) assert.equal(normalizeBusinessSocialUrl(platform, input).ok, false, String(input));
    for (const other of BUSINESS_SOCIAL_PLATFORMS.filter((p) => p !== platform))
      assert.equal(normalizeBusinessSocialUrl(platform, accounts[other]).ok, false);
  });
}

test("account paths reject platform content/login/redirect destinations", () => {
  for (const path of ["/home.php", "/away.php?to=https://evil.example", "/l.php?u=https://evil.example", "/login", "/dialog/oauth", "/sharer.php?u=https://evil.example", "/share", "/profile.php", "/profile.php?id=abc", "/profile.php?id=1&id=2"])
    assert.equal(normalizeBusinessSocialUrl("facebook", `https://facebook.com${path}`).ok, false, path);
  for (const path of ["/accounts", "/accounts/login", "/p/123", "/explore", "/reel/123"])
    assert.equal(normalizeBusinessSocialUrl("instagram", `https://instagram.com${path}`).ok, false, path);
  for (const path of ["/business", "/@business/video/1", "/login"])
    assert.equal(normalizeBusinessSocialUrl("tiktok", `https://tiktok.com${path}`).ok, false, path);
  for (const path of ["/business", "/add", "/spotlight/video", "/add/business/extra"])
    assert.equal(normalizeBusinessSocialUrl("snapchat", `https://snapchat.com${path}`).ok, false, path);
});

test("Facebook supports real numeric and legacy page profile identities", () => {
  assert.deepEqual(normalizeBusinessSocialUrl("facebook", "https://m.facebook.com/profile.php?id=123456&ref=share"), { ok: true, value: "https://m.facebook.com/profile.php?id=123456" });
  for (const path of ["/people/Business-Name/123456", "/pages/Business-Name/123456"])
    assert.deepEqual(normalizeBusinessSocialUrl("facebook", `https://facebook.com${path}`), { ok: true, value: `https://facebook.com${path}` });
});

test("shared server schemas permit zero, one and four URLs, and identify invalid fields", () => {
  const schema = z.object(businessSocialSchemas);
  assert.deepEqual(schema.parse({}), {});
  assert.deepEqual(schema.parse({ instagramUrl: accounts.instagram }), { instagramUrl: accounts.instagram });
  const all = Object.fromEntries(BUSINESS_SOCIAL_PLATFORMS.map((p) => [BUSINESS_SOCIAL_FIELDS[p], accounts[p]]));
  assert.deepEqual(schema.parse(all), all);
  const invalid = schema.safeParse({ ...all, instagramUrl: accounts.facebook });
  assert.equal(invalid.success, false);
  if (!invalid.success) assert.deepEqual(invalid.error.issues[0].path, ["instagramUrl"]);
});

test("REST create uses the shared contract; PATCH omission preserves and empty/null removes", () => {
  assert.equal(businessCreateSchema.safeParse({ name: "Existing business" }).success, true);
  assert.equal(businessCreateSchema.safeParse({ name: "Existing business", tiktokUrl: "javascript:alert(1)" }).success, false);
  const patch = businessUpdateSchema.parse({ instagramUrl: ` ${accounts.instagram} ` });
  assert.deepEqual(patch, { instagramUrl: accounts.instagram });
  assert.equal(Object.hasOwn(patch, "facebookUrl"), false);
  assert.deepEqual(businessUpdateSchema.parse({ facebookUrl: "", instagramUrl: null }), { facebookUrl: null, instagramUrl: null });
});

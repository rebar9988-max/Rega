import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeSocial, socialLinks, type SocialPlatform } from "../src/lib/social-links";

const ok = (platform: SocialPlatform, input: string) => {
  const r = normalizeSocial(platform, input);
  return r.ok ? r.value : `ERR:${r.reason}`;
};

test("usernames become the platform's own profile URL", () => {
  assert.equal(ok("instagram", "@rega24"), "https://www.instagram.com/rega24");
  assert.equal(ok("instagram", "rega.24_shop"), "https://www.instagram.com/rega.24_shop");
  assert.equal(ok("tiktok", "@rega24"), "https://www.tiktok.com/@rega24");
  assert.equal(ok("snapchat", "rega24"), "https://www.snapchat.com/add/rega24");
  assert.equal(ok("facebook", "rega24shop"), "https://www.facebook.com/rega24shop");
});

test("links on the platform's own domain are kept as https, without fragment, port or credentials", () => {
  assert.equal(ok("instagram", "https://www.instagram.com/rega24/"), "https://www.instagram.com/rega24/");
  assert.equal(ok("instagram", "instagram.com/rega24"), "https://instagram.com/rega24");
  assert.equal(ok("facebook", "http://m.facebook.com/profile.php?id=123#top"), "https://m.facebook.com/profile.php?id=123");
  assert.equal(ok("facebook", "https://fb.com/rega24"), "https://fb.com/rega24");
  assert.equal(ok("tiktok", "https://www.tiktok.com/@rega24?lang=de"), "https://www.tiktok.com/@rega24?lang=de");
  assert.equal(ok("snapchat", "https://www.snapchat.com/add/rega24"), "https://www.snapchat.com/add/rega24");
  // A domain typed alone is not mistaken for a username.
  assert.equal(ok("instagram", "www.instagram.com"), "ERR:invalid");
});

test("foreign domains, look-alikes, other schemes and empty input are refused", () => {
  assert.equal(ok("instagram", ""), "ERR:empty");
  assert.equal(ok("instagram", "   "), "ERR:empty");
  assert.equal(ok("instagram", "https://evil.example/instagram.com"), "ERR:invalid");
  assert.equal(ok("instagram", "https://instagram.com.evil.example/rega"), "ERR:invalid");
  assert.equal(ok("instagram", "https://notinstagram.com/rega"), "ERR:invalid");
  assert.equal(ok("facebook", "javascript:alert(1)"), "ERR:invalid");
  assert.equal(ok("tiktok", "https://user:pw@www.tiktok.com/@rega"), "ERR:invalid");
  assert.equal(ok("snapchat", "https://www.snapchat.com:8443/add/rega"), "ERR:invalid");
  assert.equal(ok("facebook", "https://www.instagram.com/rega24"), "ERR:invalid");
  assert.equal(ok("tiktok", "two words"), "ERR:invalid");
  assert.equal(ok("instagram", `https://www.instagram.com/${"a".repeat(400)}`), "ERR:invalid");
});

test("only stored, valid https links become buttons, in a fixed order; none means no row", () => {
  assert.deepEqual(socialLinks({}), []);
  assert.deepEqual(socialLinks({ instagramUrl: null, facebookUrl: "", tiktokUrl: null, snapchatUrl: null }), []);
  const links = socialLinks({ snapchatUrl: "https://www.snapchat.com/add/rega24", instagramUrl: "https://www.instagram.com/rega24", facebookUrl: "https://evil.example/x", tiktokUrl: "@rega24" });
  assert.deepEqual(links.map((l) => [l.platform, l.title, l.url]), [
    ["instagram", "Instagram", "https://www.instagram.com/rega24"],
    ["snapchat", "Snapchat", "https://www.snapchat.com/add/rega24"],
  ]);
});

test("the columns come from the additive migrations already applied in production (D1 0004, PostgreSQL 20261024220000)", () => {
  for (const file of ["prisma/migrations/20261024220000_business_social_links/migration.sql", "prisma/d1/migrations/0004_business_social_links.sql"]) {
    const sql = readFileSync(file, "utf8").replace(/^--.*$/gm, "");
    for (const column of ["instagramUrl", "facebookUrl", "tiktokUrl", "snapchatUrl"]) assert.match(sql, new RegExp(`ADD COLUMN "${column}" TEXT`));
    assert.doesNotMatch(sql, /\b(DROP|DELETE|UPDATE|TRUNCATE)\b/i);
  }
});

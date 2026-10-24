import test from "node:test";
import assert from "node:assert/strict";
import { directionsUrl, mapLinks, safeHttpUrl, safeTel } from "../src/lib/urls";

test("safeHttpUrl only allows http(s)", () => {
  assert.equal(safeHttpUrl("https://example.org"), "https://example.org/");
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,x"), null);
  assert.equal(safeHttpUrl("not a url"), null);
  assert.equal(safeHttpUrl(null), null);
});

test("safeTel strips everything but digits and a leading +", () => {
  assert.equal(safeTel("+49 (30) 123-4567"), "+49301234567");
  assert.equal(safeTel("12"), null);
  assert.equal(safeTel("0049+30123456"), "004930123456");
});

test("directionsUrl opens the map app at the coordinates, else searches the address", () => {
  assert.equal(directionsUrl(50.7, 6.65, "Bonner Str. 2a"), "https://www.google.com/maps/dir/?api=1&destination=50.7,6.65");
  assert.equal(directionsUrl(null, null, " Bonner Str. 2a, 53909 Zülpich "), "https://www.google.com/maps/search/?api=1&query=Bonner%20Str.%202a%2C%2053909%20Z%C3%BClpich");
  assert.equal(directionsUrl(0, 0, "x&y"), "https://www.google.com/maps/search/?api=1&query=x%26y");
  assert.equal(directionsUrl(null, null, "  "), null);
  // The edge of the world (a clamped value) is never a business: search the address instead.
  assert.equal(directionsUrl(90, 180, "Bonner Str. 2a"), "https://www.google.com/maps/search/?api=1&query=Bonner%20Str.%202a");
  assert.equal(directionsUrl(-90, 10, null), null);
});

test("mapLinks gives every map app the same destination, coordinates first, never an invented place", () => {
  assert.deepEqual(mapLinks(50.7, 6.65, "Bonner Str. 2a", "Karwans"), {
    google: "https://www.google.com/maps/dir/?api=1&destination=50.7,6.65",
    apple: "https://maps.apple.com/?daddr=50.7,6.65",
    waze: "https://waze.com/ul?ll=50.7,6.65&navigate=yes",
    geo: "geo:50.7,6.65?q=50.7,6.65(Karwans)",
  });
  // Edge-of-the-world coordinates are a clamped value: the address is used instead, URL-encoded.
  const byAddress = mapLinks(90, 180, "Bonner Str. 2a, 53909 Zülpich & Co");
  assert.equal(byAddress?.apple, "https://maps.apple.com/?daddr=Bonner%20Str.%202a%2C%2053909%20Z%C3%BClpich%20%26%20Co");
  assert.equal(byAddress?.waze, "https://waze.com/ul?q=Bonner%20Str.%202a%2C%2053909%20Z%C3%BClpich%20%26%20Co&navigate=yes");
  assert.equal(byAddress?.geo, "geo:0,0?q=Bonner%20Str.%202a%2C%2053909%20Z%C3%BClpich%20%26%20Co");
  assert.equal(mapLinks(null, null, "  "), null);
});

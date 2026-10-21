import test from "node:test";
import assert from "node:assert/strict";
import { fetchGeoCity, fetchGeoList } from "../src/lib/location-store";

test("publication counts are refreshed instead of retained in a browser geography cache", async () => {
  const original = globalThis.fetch;
  let count = 1;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.cache, "no-store");
    return Response.json({ok:true,data:{city:{id:"berlin",count},cities:[{id:"berlin",count}]}});
  };
  try {
    assert.equal((await fetchGeoCity("berlin"))?.count, 1);
    assert.equal((await fetchGeoList({country:"DE"})).cities[0].count, 1);
    count = 0; // Staff suspension between two openings/navigation attempts.
    assert.equal((await fetchGeoCity("berlin"))?.count, 0);
    assert.equal((await fetchGeoList({country:"DE"})).cities[0].count, 0);
  } finally { globalThis.fetch = original; }
});

import test from "node:test";
import assert from "node:assert/strict";
import project from "../src/config/project.json";
import { databaseTargetMatchesManifest } from "../src/lib/database-identity";

test("database ownership compares direct/pooled endpoint and database without returning connection details", () => {
  for (const host of project.neonProductionHosts) {
    const url = `postgresql://synthetic:password@${host}/neondb?sslmode=require&channel_binding=require`;
    assert.equal(databaseTargetMatchesManifest(url), true);
    for (const suffix of ["&host=other.invalid", "&hostaddr=127.0.0.1", "&service=other", "&dbname=other", "&database=other", "&port=1234"]) {
      assert.equal(databaseTargetMatchesManifest(url + suffix), false, suffix);
    }
    assert.equal(databaseTargetMatchesManifest(`postgres://${host}:5432/neondb?host=${host}`), true);
    assert.equal(databaseTargetMatchesManifest(`postgres://${host}:1234/neondb`), false);
    assert.equal(databaseTargetMatchesManifest(`postgres://${host}/other`), false);
    assert.equal(databaseTargetMatchesManifest(`https://${host}/neondb`), false);
  }
  for (const value of [undefined, "invalid", "postgres://localhost/neondb", "postgres://other.invalid/neondb"]) assert.equal(databaseTargetMatchesManifest(value), false);
});

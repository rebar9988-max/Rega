/** Real workerd codec compatibility; no credentials, database, remote services or deployment. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { encode, decode } from "fast-png";
import jpeg from "jpeg-js";
const url = "http://localhost:8797";
let stored;
const storage = createServer((req,res) => {
  const chunks=[];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", () => { stored={bytes:Buffer.concat(chunks),mime:req.headers["content-type"]};res.writeHead(200,{etag:'"local-test"'});res.end(); });
});
await new Promise(resolve => storage.listen(8796,"127.0.0.1",resolve));
const child = spawn(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "dev", "--local", "--config", "tests/runtime/business-image-wrangler.jsonc", "--port", "8797"], {stdio:"ignore"});
let exited = false;
child.on("exit", () => { exited = true; });
try {
  let ready = false;
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    assert.ok(!exited, "Codec test Worker exited");
    try { ready = (await fetch(url, {signal:AbortSignal.timeout(2000)})).ok; } catch { /* starting */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Codec Worker readiness");
  const data = new Uint8Array([255,0,0,255,0,255,0,128]);
  const png = encode({width:2,height:1,data,text:{Comment:"private metadata"}});
  const jpg = jpeg.encode({width:2,height:1,data},90).data;
  for (const [mime,bytes] of [["image/png",png],["image/jpeg",jpg]]) {
    const res = await fetch(url,{method:"POST",headers:{"content-type":mime},body:bytes});
    assert.equal(res.status,200,`${mime} must decode in workerd`);
    assert.equal(res.headers.get("x-width"),"2");
    const output = new Uint8Array(await res.arrayBuffer());
    if (mime === "image/png") {
      assert.deepEqual(decode(output).data,data);
      assert.ok(!Buffer.from(output).includes(Buffer.from("private metadata")));
    } else assert.equal(jpeg.decode(output).height,1);
  }
  for (const [mime,bytes] of [["image/png",jpg],["image/jpeg",png],["image/png",Buffer.from("<svg/>")],["image/png",png.slice(0,-8)]]) {
    assert.equal((await fetch(url,{method:"POST",headers:{"content-type":mime},body:bytes})).status,422);
  }
  const upload = await fetch(`${url}?store=1`,{method:"POST",headers:{"content-type":"image/png"},body:png});
  assert.equal(upload.status,200,"Existing S3 SDK storage must execute inside workerd");
  assert.equal((await upload.json()).url,"https://media.example.org/business-images/test/png");
  assert.equal(stored?.mime,"image/png");
  assert.deepEqual(decode(stored.bytes).data,data);
  assert.ok(!stored.bytes.includes(Buffer.from("private metadata")));
  console.log("Worker image codecs: PNG/JPEG normalization, crop pixels, metadata removal and invalid-file rejection and existing S3 upload passed");
} finally { child.kill("SIGTERM"); storage.close(); }

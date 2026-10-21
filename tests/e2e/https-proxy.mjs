/** Loopback-only TLS for WebKit E2E. Preserve the production upgrade-insecure-requests CSP. */
import https from "node:https";
import http from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const port = Number(process.env.E2E_PORT ?? 3111);
const dir = mkdtempSync(join(tmpdir(), "rega-e2e-tls-"));
try {
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(dir,"key.pem"), "-out", join(dir,"cert.pem"), "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"], {stdio:"ignore",timeout:10_000});
  const server = https.createServer({key:readFileSync(join(dir,"key.pem")),cert:readFileSync(join(dir,"cert.pem"))}, (request,response) => {
    const upstream = http.request({hostname:"127.0.0.1",port,path:request.url,method:request.method,
      headers:{...request.headers,"x-forwarded-proto":"https","x-forwarded-host":request.headers.host}}, res => {
        response.writeHead(res.statusCode ?? 502,res.headers);res.pipe(response);
      });
    upstream.on("error", () => { if (!response.headersSent) response.writeHead(503); response.end(); });
    request.pipe(upstream);
  });
  server.listen(port+1,"127.0.0.1");
  const close = () => server.close(() => process.exit(0));
  process.on("SIGTERM",close);process.on("SIGINT",close);
} catch (error) { rmSync(dir,{recursive:true,force:true});throw error; }
process.on("exit", () => rmSync(dir,{recursive:true,force:true}));

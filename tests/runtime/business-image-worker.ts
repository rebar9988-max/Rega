/** Local-only codec probe, never included in the production Worker or deployed. */
import { storeBusinessImage } from "../../src/lib/storage";
import { optimizeBusinessImage } from "../../src/features/business-images/process";
const worker = {
  async fetch(request: Request) {
    if (request.method === "GET") return new Response("ready");
    try {
      const image = optimizeBusinessImage(new Uint8Array(await request.arrayBuffer()), request.headers.get("content-type") ?? "");
      if (new URL(request.url).searchParams.has("store")) return Response.json({url: await storeBusinessImage(`business-images/test/${image.extension}`, image.bytes, image.mimeType)});
      return new Response(new Uint8Array(image.bytes).buffer, { headers: { "content-type": image.mimeType, "x-width": String(image.width), "x-height": String(image.height) } });
    } catch { return new Response("invalid image", { status: 422 }); }
  },
};

export default worker;

import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { parseRange } from "../../lib/byteRange";

// Cloudflare's static asset layer ignores Range headers, and Safari won't play a video
// without 206 responses. This route serves public/assets/*.mp4 with range support.
// ponytail: buffers the whole file per request; fine for a ~2 MB promo, move to R2 for big media.
export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const file = params.file ?? "";
  if (!/^[\w-]+\.mp4$/.test(file)) return new Response("Not Found", { status: 404 });

  const asset = await env.ASSETS.fetch(new URL(`/assets/${file}`, request.url));
  if (!asset.ok) return new Response("Not Found", { status: 404 });

  const body = await asset.arrayBuffer();
  const size = body.byteLength;
  const headers = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=86400",
  };

  const range = parseRange(request.headers.get("Range"), size);
  if (range === "unsatisfiable") {
    return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
  }
  if (!range) return new Response(body, { headers: { ...headers, "Content-Length": String(size) } });

  const [start, end] = range;
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
};

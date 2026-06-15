import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import app from "./dist/server/server.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const staticDir = join(__dirname, "dist/client");
const port = parseInt(process.env.PORT ?? "8080", 10);

const MIME = {
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".html": "text/html",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(req.url.split("?")[0]);
    const filePath = join(staticDir, pathname);

    if (existsSync(filePath) && !pathname.endsWith("/")) {
      const ext = extname(filePath);
      res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
      if (pathname.startsWith("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
      createReadStream(filePath).pipe(res);
      return;
    }

    const url = `http://${req.headers.host}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v != null) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    }

    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const request = new Request(url, {
      method: req.method,
      headers,
      body: hasBody ? Readable.toWeb(req) : null,
      ...(hasBody ? { duplex: "half" } : {}),
    });

    const response = await app.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));

    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }
});

server.listen(port, () => {
  console.log(`Server listening on :${port}`);
});

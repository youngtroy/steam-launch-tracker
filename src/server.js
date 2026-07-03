import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { dataPath, publicDir, readJson } from "./paths.js";

const port = Number(process.env.PORT || 5177);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);

  if (url.pathname === "/api/data") {
    const data = readJson(dataPath, {
      meta: {},
      apps: {},
      rank_snapshots: [],
      app_snapshots: []
    });
    send(res, 200, "application/json; charset=utf-8", JSON.stringify(data));
    return;
  }

  const safePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));

  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath)) {
    send(res, 404, "text/plain; charset=utf-8", "Not found");
    return;
  }

  send(res, 200, mime[path.extname(filePath)] || "application/octet-stream", fs.readFileSync(filePath));
});

server.listen(port, () => {
  console.log(`Steam Launch Tracker running at http://localhost:${port}`);
});

function send(res, status, contentType, body) {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  res.end(body);
}

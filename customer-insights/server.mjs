import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join } from "node:path";
import { loadSnapshot } from "./data.mjs";

const publicDirectory = fileURLToPath(new URL("./public/", import.meta.url));
const routes = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/model.mjs", ["../model.mjs", "text/javascript; charset=utf-8"]]
]);

export function createAppServer(loader = loadSnapshot, { live = false } = {}) {
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    try {
      if (request.method !== "GET") {
        response.writeHead(405, { Allow: "GET" }).end("Method not allowed");
        return;
      }
      const path = new URL(request.url, "http://localhost").pathname;
      if (path === "/api/snapshot") {
        const snapshot = await loader();
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify(snapshot));
        return;
      }
      const route = routes.get(path);
      if (!route) { response.writeHead(404).end("Not found"); return; }
      const content = await readFile(join(publicDirectory, route[0]));
      response.writeHead(200, { "Content-Type": route[1] }).end(content);
    } catch (error) {
      console.error("Customer Insights request failed:", error);
      response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify({
        error: live
          ? "Could not query live Fabric data. Check Azure CLI sign-in, SQL permissions and server output. No CSV fallback was used."
          : "Could not load the POC data. Check the server output and CSV source files, then retry."
      }));
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535");
  const live = process.argv.includes("--live");
  const loader = live ? (await import("./fabric.mjs")).loadLiveData : loadSnapshot;
  const initial = await loader();
  console.log(`Data mode: ${initial.mode}; ${initial.accounts.length} accounts${live ? "; authenticated live Fabric SQL" : "; local CSV snapshot"}`);
  const server = createAppServer(loader, { live });
  server.on("error", error => { console.error("Unable to start Customer Insights:", error.message); process.exitCode = 1; });
  server.listen(port, "127.0.0.1", () => console.log(`Customer Insights ready: http://127.0.0.1:${port}`));
}

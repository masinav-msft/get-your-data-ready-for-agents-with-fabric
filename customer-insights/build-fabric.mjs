import { build } from "esbuild";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("./", import.meta.url);
const registry = JSON.parse(await readFile(new URL("rayfin/.deployments.json", root), "utf8"));
const deployment = registry.deployments[registry.active];
if (!deployment?.fabricApiUrl || !deployment.publishableKey || !deployment.fabricWorkspaceId || !deployment.fabricItemId) {
  throw new Error("Select an existing authenticated Fabric deployment before building");
}
await mkdir(new URL("dist/", root), { recursive: true });
await build({
  entryPoints: [fileURLToPath(new URL("src/fabric-app.ts", root))],
  outfile: fileURLToPath(new URL("dist/app.mjs", root)),
  bundle: true, format: "esm", platform: "browser", target: "es2022",
  tsconfig: fileURLToPath(new URL("tsconfig.json", root)),
  define: {
    __FABRIC_CONFIG__: JSON.stringify({
      baseUrl: deployment.fabricApiUrl, publishableKey: deployment.publishableKey,
      workspaceId: deployment.fabricWorkspaceId, projectId: deployment.fabricItemId
    })
  },
  plugins: [{
    name: "shared-browser-model",
    setup(builder) {
      builder.onResolve({ filter: /^\/model\.mjs$/ }, () => ({
        path: fileURLToPath(new URL("model.mjs", root))
      }));
    }
  }]
});
await copyFile(new URL("public/styles.css", root), new URL("dist/styles.css", root));
await writeFile(new URL("dist/index.html", root),
  (await readFile(new URL("public/index.html", root), "utf8"))
    .replace("POC snapshot <small>", "Fabric hosted <small>")
    .replace(">DEMO DATA<", ">FABRIC SIGN-IN<")
    .replace(">Snapshot demonstration<", ">Authenticated Fabric app<")
    .replace("Existing POC CSVs, not a live connection. No CRM changes or AI calls are made.", "Sign in to query the curated Fabric lakehouse. Read-only; no CRM changes or AI calls.")
);

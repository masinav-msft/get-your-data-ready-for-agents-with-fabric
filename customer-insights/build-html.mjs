import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadSnapshot } from "./data.mjs";

const modelImport = 'import { filterAccounts, summarize, rankAccounts, isActiveBreach, exportCsv } from "/model.mjs";';

function replaceOnce(source, marker, replacement) {
  if (source.split(marker).length !== 2) throw new Error(`Expected exactly one build marker: ${marker}`);
  return source.replace(marker, () => replacement);
}

export async function renderStandalone(snapshot) {
  const [template, styles, model, app] = await Promise.all([
    readFile(new URL("./public/index.html", import.meta.url), "utf8"),
    readFile(new URL("./public/styles.css", import.meta.url), "utf8"),
    readFile(new URL("./model.mjs", import.meta.url), "utf8"),
    readFile(new URL("./public/app.mjs", import.meta.url), "utf8")
  ]);
  if (/<\/style/i.test(styles)) throw new Error("Styles contain an unexpected closing style tag");
  const script = `${model}\n${replaceOnce(app, modelImport, "")}`.replace(/<\/script/gi, "<\\/script");
  const data = JSON.stringify(snapshot).replace(/</g, "\\u003c");
  let document = replaceOnce(template, '<link rel="stylesheet" href="/styles.css">', `<style>\n${styles}\n</style>`);
  document = replaceOnce(document, '<script type="module" src="/app.mjs"></script>', "");
  document = replaceOnce(document, "</body>", `<script id="embedded-snapshot" type="application/json">${data}</script>\n<script type="module">\n${script}\n</script>\n</body>`);
  return document;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const snapshot = await loadSnapshot();
  const document = await renderStandalone(snapshot);
  const destination = new URL("./Customer-360-Insights.html", import.meta.url);
  await writeFile(destination, document, "utf8");
  console.log(`Standalone HTML created: ${fileURLToPath(destination)}`);
  console.log(`${snapshot.accounts.length} accounts; ${Buffer.byteLength(document)} bytes. No server or network connection required.`);
  console.log("The file contains the full demo snapshot. Review included data before sharing.");
}

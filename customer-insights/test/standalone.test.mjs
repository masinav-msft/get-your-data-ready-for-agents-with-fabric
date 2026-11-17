import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { loadSnapshot } from "../data.mjs";
import { renderStandalone } from "../build-html.mjs";

const snapshot = await loadSnapshot();

test("standalone HTML inlines styles, data and executable modules without external assets", async () => {
  const document = await renderStandalone(snapshot);
  assert.doesNotMatch(document, /<script\b[^>]*\bsrc=/i);
  assert.doesNotMatch(document, /<link\b[^>]*\brel="stylesheet"/i);
  assert.match(document, /--cp-bg:/);
  assert.match(document, /scoutTheme/);
  const serialized = document.match(/<script id="embedded-snapshot" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(serialized);
  assert.deepEqual(JSON.parse(serialized[1]), snapshot);
  const module = document.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(module);
  assert.doesNotMatch(module[1], /^\s*import\s/m);
  const result = spawnSync(process.execPath, ["--check", "--input-type=module"], { input: module[1], encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("embedded snapshot cannot break out of its script container", async () => {
  const malicious = '</script><script>alert("not executable")</script>';
  const data = { ...snapshot, accounts: [{ ...snapshot.accounts[0], AccountName: malicious }] };
  const document = await renderStandalone(data);
  assert.equal((document.match(/<script\b/g) ?? []).length, 3);
  assert.ok(!document.includes(malicious));
  const serialized = document.match(/<script id="embedded-snapshot" type="application\/json">([\s\S]*?)<\/script>/);
  assert.equal(JSON.parse(serialized[1]).accounts[0].AccountName, malicious);
});

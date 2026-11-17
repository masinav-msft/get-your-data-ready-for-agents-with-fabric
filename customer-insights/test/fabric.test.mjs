import test from "node:test";
import assert from "node:assert/strict";
import { loadSnapshot, definitions, validateAndJoin } from "../data.mjs";
import { loadLiveData } from "../fabric.mjs";
import { summarize } from "../model.mjs";
import { connectorSnapshot } from "../connector-data.mjs";

const snapshot = await loadSnapshot();
function resultSets() {
  return Object.keys(definitions).map(name => {
    const rows = name === "accounts" ? snapshot.accounts : snapshot.accounts.flatMap(a => a[name]);
    return rows.map(row => Object.fromEntries([...definitions[name].required, ...definitions[name].numeric].map(field => [
      field, field === "SLABreached" ? row[field] === "True" : row[field]
    ])));
  });
}
const status = async () => ({ status: "succeeded", checkedAt: new Date().toISOString(), lastIngestedAt: new Date().toISOString() });

test("live loader queries all tables, preserves typed values and identifies provenance", async () => {
  let queryText;
  const data = await loadLiveData(async query => {
    queryText = query;
    return { recordsets: resultSets() };
  }, status);
  assert.equal(data.mode, "live");
  assert.equal(data.refreshSeconds, 60);
  assert.equal(data.sources.length, 5);
  assert.equal(data.sources[0].table, "dbo.gold_customer_360_ai_ready");
  assert.match(queryText, /TOP \(10001\)/);
  assert.match(queryText, /silver_d365_contacts/);
  assert.equal(summarize(data.accounts).breaches, 4);
  assert.equal(summarize(data.accounts).revenue, 31090000);
});

test("subsequent live requests recalculate from changed Fabric results, without CSV fallback", async () => {
  const sets = resultSets();
  const first = await loadLiveData(async () => ({ recordsets: sets }), status);
  sets[0][0].AnnualRevenueUSD += 1000;
  const second = await loadLiveData(async () => ({ recordsets: sets }), status);
  assert.equal(summarize(second.accounts).revenue - summarize(first.accounts).revenue, 1000);
  await assert.rejects(loadLiveData(async () => { throw new Error("SQL access denied"); }, status), /SQL access denied/);
});

test("truncated, missing and inconsistent Fabric results fail explicitly", async () => {
  await assert.rejects(loadLiveData(async () => ({ recordsets: [] }), status), /five expected/);
  const oversized = resultSets();
  oversized[0] = Array.from({ length: 10001 }, () => oversized[0][0]);
  await assert.rejects(loadLiveData(async () => ({ recordsets: oversized }), status), /exceeds/);
  const inconsistent = resultSets();
  inconsistent[0][0].PipelineValueUSD += 1;
  await assert.rejects(loadLiveData(async () => ({ recordsets: inconsistent }), status), /pipeline mismatch/);
});

test("empty related tables are valid but orphaned relationships and missing accounts are not", () => {
  const tables = Object.fromEntries(Object.keys(definitions).map((name, i) => [name, resultSets()[i]]));
  tables.contacts = [];
  assert.equal(validateAndJoin(tables)[0].contacts.length, 0);
  tables.contacts = [{ ...snapshot.accounts[0].contacts[0], AccountNumber: "UNKNOWN" }];
  assert.throws(() => validateAndJoin(tables), /Orphan contacts/);
  tables.accounts = [];
  assert.throws(() => validateAndJoin(tables), /no records/);
});

function connectorPages() {
  return Object.fromEntries(Object.keys(definitions).map((name, i) => [
    name, { items: resultSets()[i], hasNextPage: false }
  ]));
}

test("hosted connector data preserves KPIs, boolean conversion and honest provenance", () => {
  const data = connectorSnapshot(connectorPages());
  assert.equal(data.hosting, "fabric");
  assert.equal(summarize(data.accounts).revenue, 31090000);
  assert.equal(summarize(data.accounts).breaches, 4);
  assert.equal(summarize(data.accounts).pipeline, 5530000);
  assert.match(data.disclosure, /caller's source permissions/);
  assert.equal(data.sources[0].table, "dbo.gold_customer_360_ai_ready");
});

test("hosted data rejects partial pages, excess rows and inconsistent tables without fallback", () => {
  const pages = connectorPages();
  pages.accounts.hasNextPage = true;
  assert.throws(() => connectorSnapshot(pages), /incomplete/);
  pages.accounts.hasNextPage = false;
  pages.accounts.items = Array.from({ length: 10001 }, () => pages.accounts.items[0]);
  assert.throws(() => connectorSnapshot(pages), /10000-row/);
  assert.throws(() => connectorSnapshot({}), /valid accounts page/);
  const mismatched = connectorPages();
  mismatched.accounts.items[0].PipelineValueUSD += 1;
  assert.throws(() => connectorSnapshot(mismatched), /pipeline mismatch/);
});

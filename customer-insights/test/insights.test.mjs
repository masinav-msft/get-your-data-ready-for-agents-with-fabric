import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSnapshot } from "../data.mjs";
import { createAppServer } from "../server.mjs";
import { summarize, filterAccounts, rankAccounts, parseCsv, exportCsv } from "../model.mjs";

const snapshot = await loadSnapshot();

test("full portfolio KPIs match the underlying CSV values", () => {
  const totals = summarize(snapshot.accounts);
  assert.equal(totals.count, 12);
  assert.equal(totals.revenue, 31090000);
  assert.equal(totals.pipeline, 5530000);
  assert.equal(totals.atRisk, 2365000);
  assert.equal(totals.breaches, 4);
  assert.equal(totals.openCases, 7);
  assert.equal(totals.highChurn, 3);
  assert.equal(totals.highChurnPipeline, 2090000);
  assert.equal(totals.averageChurn, 37);
  assert.equal(totals.stages.reduce((s, row) => s + row.value, 0), totals.pipeline);
  assert.equal(totals.stages.find(s => s.stage === "Closing").value, 1770000);
});

test("filters are combined and KPI totals follow selected accounts", () => {
  const healthcare = filterAccounts(snapshot.accounts, { industry: "Healthcare" });
  assert.equal(healthcare.length, 2);
  assert.equal(summarize(healthcare).atRisk, 955000);
  const selected = filterAccounts(snapshot.accounts, { industry: "Healthcare", segment: "Enterprise", search: "contoso", focus: "sla" });
  assert.equal(selected.length, 1);
  assert.equal(summarize(selected).pipeline, 680000);
  assert.equal(summarize(selected).breaches, 1);
  assert.equal(filterAccounts(snapshot.accounts, { search: "ACC-1007" })[0].AccountName, "Woodgrove Bank");
  assert.equal(filterAccounts(snapshot.accounts, { focus: "risk" }).length, 4);
  assert.equal(filterAccounts(snapshot.accounts, { focus: "churn" }).length, 3);
  assert.equal(filterAccounts(snapshot.accounts, { focus: "closing" }).length, 3);
  assert.equal(filterAccounts(snapshot.accounts, { focus: "sla" }).length, 3);
});

test("highest-risk customer drilldown joins case, opportunity, policy and contact", () => {
  const account = rankAccounts(snapshot.accounts)[0];
  assert.equal(account.AccountNumber, "ACC-1007");
  assert.equal(account.opportunities[0].EstimatedValueUSD, 890000);
  assert.equal(account.cases.length, 2);
  assert.equal(account.policies[0].MaxAuthorizedCreditPct, 18);
  assert.equal(account.contacts[0].FullName, "Demo Contact 07");
  assert.equal(snapshot.mode, "snapshot");
  assert.equal(snapshot.sources.length, 5);
});

test("empty selections and exact churn threshold do not fabricate results", () => {
  const totals = summarize([]);
  assert.equal(totals.pipeline, 0);
  assert.equal(totals.averageChurn, null);
  assert.equal(totals.breaches, 0);
  assert.equal(filterAccounts(snapshot.accounts, { search: "nonexistent" }).length, 0);
  const account = { ...snapshot.accounts[0], DatabricksChurnScore: 65 };
  assert.equal(filterAccounts([account], { focus: "churn" }).length, 1);
  assert.equal(filterAccounts([{ ...account, DatabricksChurnScore: 64.9 }], { focus: "churn" }).length, 0);
  const resolved = { ...account, cases: [{ SLABreached: "True", CaseStatus: "Resolved" }] };
  assert.equal(summarize([resolved]).breaches, 0);
});

test("weighted pipeline is calculated using each opportunity probability", () => {
  const account = {
    AnnualRevenueUSD: 1000, DatabricksChurnScore: 20, cases: [],
    opportunities: [
      { EstimatedValueUSD: 100, WinProbabilityPct: 25, SalesStage: "Closing", DealRiskStatus: "High Risk" },
      { EstimatedValueUSD: 200, WinProbabilityPct: 50, SalesStage: "Proposal", DealRiskStatus: "Low Risk" }
    ]
  };
  assert.equal(summarize([account]).weightedPipeline, 125);
  assert.equal(summarize([account]).atRisk, 100);
});

test("CSV parsing handles BOM, CRLF, quoted commas, escaped quotes and multiline values", () => {
  assert.deepEqual(parseCsv('\uFEFFid,name\r\n1,"Acme, Inc"\r\n2,"A ""quoted""\nname"\r\n'), [
    { id: "1", name: "Acme, Inc" }, { id: "2", name: 'A "quoted"\nname' }
  ]);
  for (const invalid of ["", 'a,b\n"unfinished,b', "a,b\n1", "a,a\n1,2", 'a,b\n"x"junk,2']) {
    assert.throws(() => parseCsv(invalid));
  }
});

test("CSV export preserves filtered shape and neutralizes spreadsheet formulas", () => {
  const selected = filterAccounts(snapshot.accounts, { search: "Woodgrove" });
  const rows = parseCsv(exportCsv(selected));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].PipelineValueUSD, "890000");
  const unsafe = { ...selected[0], AccountName: '=HYPERLINK("https://example.com")' };
  assert.ok(parseCsv(exportCsv([unsafe]))[0].AccountName.startsWith("'="));
});

test("invalid numeric source data fails explicitly", async () => {
  const directory = await mkdtemp(join(tmpdir(), "customer-insights-test-"));
  try {
    for (const source of snapshot.sources) {
      await copyFile(new URL(`../../data/csv/${source.file}`, import.meta.url), join(directory, source.file));
    }
    const path = join(directory, "gold_customer_360_ai_ready.csv");
    const text = await readFile(path, "utf8");
    await writeFile(path, text.replace("4850000", "not-a-number"));
    await assert.rejects(loadSnapshot(directory), /invalid AnnualRevenueUSD/);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("server serves the dashboard and data contract and rejects unknown paths and writes", async () => {
  const server = createAppServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${base}/api/snapshot`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).accounts.length, 12);
    for (const path of ["/", "/styles.css", "/app.mjs", "/model.mjs"]) {
      const asset = await fetch(base + path);
      assert.equal(asset.status, 200);
      assert.ok((await asset.text()).length > 100);
    }
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.equal((await fetch(`${base}/data/dataverse_accounts.json`)).status, 404);
    assert.equal((await fetch(`${base}/api/snapshot`, { method: "POST" })).status, 405);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test("API failures return an explicit error, never a successful empty dataset", async () => {
  const server = createAppServer(async () => { throw new Error("Test source unavailable"); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/snapshot`);
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /Could not load/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

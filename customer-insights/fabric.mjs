import { AzureCliCredential } from "@azure/identity";
import sql from "mssql";
import { readFile } from "node:fs/promises";
import { definitions, validateAndJoin } from "./data.mjs";

export const config = JSON.parse(await readFile(new URL("./fabric-config.json", import.meta.url), "utf8"));
export const credential = new AzureCliCredential({ processTimeoutInMs: 90000 });
export const stateDirectory = new URL("./.state/", import.meta.url);
export const tableNames = {
  accounts: "gold_customer_360_ai_ready",
  opportunities: "silver_d365_opportunities",
  cases: "silver_d365_service_cases",
  contacts: "silver_d365_contacts",
  policies: "silver_sharepoint_sla_policies"
};
const rowLimit = 10000;

export async function readSyncState() {
  try {
    return JSON.parse(await readFile(new URL("d365-sync.json", stateDirectory), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { status: "not-started", message: "D365 ingestion worker has not recorded a run." };
    throw error;
  }
}

export async function queryFabric(query) {
  const token = await credential.getToken("https://database.windows.net/.default");
  const pool = new sql.ConnectionPool({
    server: config.server, database: config.database,
    authentication: { type: "azure-active-directory-access-token", options: { token: token.token } },
    options: { encrypt: true, trustServerCertificate: false },
    connectionTimeout: 60000, requestTimeout: 60000,
    pool: { max: 1, min: 0 }
  });
  pool.on("error", error => console.error("Fabric SQL pool error:", error.message));
  try {
    await pool.connect();
    return await pool.request().query(query);
  } finally {
    await pool.close();
  }
}

export async function loadLiveData(query = queryFabric, getSyncState = readSyncState) {
  const names = Object.keys(definitions);
  const statements = names.map(name => {
    const columns = [...definitions[name].required, ...definitions[name].numeric];
    return `SELECT TOP (${rowLimit + 1}) ${columns.map(c => `[${c}]`).join(", ")} FROM [dbo].[${tableNames[name]}] ORDER BY [${columns[0]}]`;
  });
  const result = await query(`SET NOCOUNT ON;\n${statements.join(";\n")};`);
  if (!Array.isArray(result.recordsets) || result.recordsets.length !== names.length) throw new Error("Fabric did not return all five expected result sets");
  const tables = Object.fromEntries(names.map((name, i) => {
    const rows = result.recordsets[i];
    if (rows.length > rowLimit) throw new Error(`Fabric ${tableNames[name]} exceeds the ${rowLimit}-row app limit; add server-side paging before using this dataset`);
    return [name, rows];
  }));
  return {
    mode: "live", loadedAt: new Date().toISOString(), refreshSeconds: config.refreshSeconds,
    workspace: config.workspaceName, lakehouse: config.lakehouseName,
    disclosure: "Queried from Fabric now. D365 account/contact ingestion runs on this computer; Gold is rebuilt by a Fabric notebook. Opportunities, cases, policy, churn and recommended actions remain prepared/enriched data, not live upstream feeds.",
    sync: await getSyncState(),
    sources: names.map(name => ({ name, table: `dbo.${tableNames[name]}`, rows: tables[name].length })),
    accounts: validateAndJoin(tables)
  };
}

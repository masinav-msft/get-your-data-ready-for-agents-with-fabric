import { definitions, validateAndJoin } from "./contract.mjs";

export function connectorSnapshot(pages) {
  const tables = Object.fromEntries(Object.keys(definitions).map(name => {
    const page = pages[name];
    if (!page || !Array.isArray(page.items) || typeof page.hasNextPage !== "boolean") {
      throw new Error(`Fabric connector did not return a valid ${name} page`);
    }
    if (page.hasNextPage || page.items.length > 10000) {
      throw new Error(`Fabric ${name} results are incomplete or exceed the 10000-row app limit; add paging before using this dataset`);
    }
    return [name, page.items];
  }));
  return {
    mode: "live", hosting: "fabric", loadedAt: new Date().toISOString(), refreshSeconds: 60,
    workspace: "Configured Fabric workspace", lakehouse: "Customer 360 lakehouse",
    disclosure: "Hosted in Fabric with Entra SSO. Read-only lakehouse queries use each signed-in caller's source permissions. Source freshness is separate: opportunities, cases, policy, churn and recommended actions remain prepared/enriched POC inputs.",
    sources: Object.entries(definitions).map(([name, definition]) => ({
      name, table: `dbo.${definition.file.replace(/\.csv$/, "")}`, rows: tables[name].length
    })),
    accounts: validateAndJoin(tables)
  };
}

# Setup: local first, Fabric when ready

## 1. Local synthetic-data experience

Use Node.js 22 or 24. The pinned Rayfin CLI does not support Node.js 26.

From `customer-insights`:

```powershell
Copy-Item fabric-config.example.json fabric-config.json
npm ci
npm test
npm start
```

Open http://127.0.0.1:4173/. These tests use synthetic data and mocked Fabric responses; no cloud credentials are required.

To regenerate the six sample CSVs from the repository root:

```powershell
node .\scripts\create-demo-data.mjs
```

The generator never reads original customer exports or connects to an upstream service. Do not use the generated account identifiers as the scope of a real Dataverse environment.

## 2. Bootstrap a dedicated demo lakehouse

1. Use a supported Fabric capacity and create a **dedicated disposable demo lakehouse**, not a production or existing customer lakehouse.
2. Upload the contents of `data/csv` to `Files/agent-ready-demo/csv`.
3. Upload `data/schema.json` to `Files/agent-ready-demo/schema.json`.
4. Create a PySpark notebook with that lakehouse attached as the default. Paste the code from [the bootstrap](../notebooks/01_load_synthetic_demo.py).
5. Review the destination, set `confirm_synthetic_demo_load = True` in the notebook, and run it.
6. The loader refuses to run if any of the six destination tables already exists. It does not overwrite existing data. If a run fails partially, inspect it and use a new dedicated lakehouse rather than blindly rerunning.
7. Wait for SQL analytics endpoint propagation, then compare row counts, risk totals and joins with the local app.

The notebook is a Fabric runtime script, not a local Python program. Its Spark/OneLake execution must be validated in your environment; local tests do not certify a new Fabric deployment.

## 3. Configure local live SQL access

Edit the ignored `customer-insights/fabric-config.json`:

- `workspaceName` and `workspaceId`: your workspace.
- `lakehouseName` and `lakehouseId`: your demo lakehouse.
- `sqlEndpointId`: your lakehouse SQL analytics endpoint item ID.
- `server`: its SQL server hostname.
- `database`: the database/catalog name accepted by that endpoint.
- `dataverseUrl`: only needed if intentionally configuring the optional Dataverse refresh.

Authenticate Azure CLI to the correct tenant and ensure your identity has source read permissions:

```powershell
az login --tenant YOUR_TENANT_ID
npm run start:live
```

The local server uses your CLI identity. This is **not** per-browser-user authentication; keep it on loopback. Do not publish or port-forward this server as a customer-facing service.

The browser polls at 60 seconds while visible and pauses while a briefing is open. Query time, upstream refresh and SQL propagation are separate freshness factors.

## 4. Optional Dataverse refresh

The included worker refreshes attributes and contacts for the **existing curated account-number scope**. It is not a full Dynamics 365 implementation, native Link to Fabric, or a connector for every D365 table.

Do not run it directly against the synthetic scope. First onboard approved real accounts into a separate authorized environment, map schemas and prepared enrichment, configure the correct Dataverse URL, and review data retention and permissions.

After that review, the available commands are:

```powershell
npm run deploy:refresh
npm run sync:d365
# Optional foreground polling:
npm run sync:d365:watch
```

Deploying the refresh creates or updates a notebook. Running the worker uploads extracts and updates Silver/Gold data in Fabric; it is not read-only with respect to the lakehouse. It makes no D365 source writes. Prepared opportunities, cases, policies, churn and recommended actions are retained, not refreshed from their original upstream systems.

The worker has explicit scope checks, local locking, job monitoring, a five-minute submission guard and a periodic rebuild request. None of those timers establishes a publication SLA. Replace the local computer/CLI dependency with managed ingestion before production.

## 5. Deploy the native Fabric App

Fabric Apps are preview capabilities. Confirm region, tenant availability, current licensing and preview acceptance.

The reusable files are in `customer-insights/rayfin`. No original deployment registry or connector discovery metadata is included.

1. Set the connector `workspaceId` and SQL-endpoint `itemId` in `rayfin/rayfin.yml` to your own resources.
2. Keep `auth.type: delegated`, authenticated read-only entities and `assetAccess: protected`. Do not replace these with owner/application identity merely to bypass permission errors.
3. Sign into the version-pinned CLI and initialize a **new** app from `customer-insights`:

```powershell
npx rayfin login
npx rayfin init . --project-name agent-ready-customer360 --services auth --auth-methods fabric --workspace-id YOUR_WORKSPACE_ID
```

Do not use `--overwrite` on the existing source. Review initialization output and configuration changes before deploying. CLI initialization can generate local agent context and a deployment registry; neither belongs in a data export.

4. Confirm the selected deployment registry exists. The custom frontend build reads its nonsecret endpoint, publishable key, workspace and item values.
5. Deploy, supplying your workspace:

```powershell
npm run deploy:fabric -- --workspace-id YOUR_WORKSPACE_ID
```

6. Register the actual hosted origin as an allowed redirect URI in `rayfin/rayfin.yml` if the CLI has not done so, and redeploy. Do not use an origin from another user's deployment.
7. Inspect connector generation/application output, not only the top-level deployment status. If needed, inspect `npx rayfin up connector apply --help` and apply the configured connector after correcting compilation errors. `rayfin/tsconfig.json` must emit the connector schema to `.temp/compiled`.
8. Test sign-in, source queries, reload, anonymous page/asset/API denial and restricted-user results. Validate the absence of data snapshots and secrets from the hosted bundle.

Run `npx tsc --noEmit` to check the frontend types locally. `npm run build:fabric` additionally requires your generated deployment registry; omitting that environment-specific file from Git is intentional.

The SDK can use application/owner identity for SQL connectors by default in this version. Explicit delegated mode is important, but source row/field restrictions still have to exist and be tested.

## 6. Power BI, agent and Copilot

- **Power BI:** open/import the TMDL definition using a supported model-authoring tool. Replace the example SQL host and endpoint database identifier in `semantic_model/definition/expressions.tmdl`. Validate Direct Lake/source mapping, measures and permissions. No report visual layout or role definitions are included.
- **Fabric Data Agent:** create an agent in your workspace, select the six curated lakehouse tables, use [the instructions](../agent/instructions.md), validate [the examples](../agent/examples.sql) against your own endpoint, then publish and test.
- **M365 Copilot:** configure the published Data Agent integration supported by your tenant. The user needs the applicable Copilot entitlement, tenant settings and agent/source access. Generic chat does not automatically discover every Fabric table.
- **Fabric IQ:** entity/relationship modeling is an optional additional step, not provisioned by this repository.

## 7. Real SharePoint and Databricks connections

The shipped policy and score files are prepared scenarios. To replace them:

1. Choose a supported ingestion/shortcut/mirroring approach for the actual source and region.
2. Configure credentials and least privilege outside this repository.
3. Map stable customer identifiers and validate policy versioning/active-policy rules.
4. Validate score lineage, model/version information and freshness; do not treat an uncalibrated score as a churn probability.
5. Reconcile all six tables and test restricted-user access through each consumption route.

Catalog metadata mirroring, database replication and OneLake shortcuts are different mechanisms. Do not describe every integration as zero-copy, instant or a security-policy sync.

import { readFile, writeFile, mkdir, rename, open, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { config, credential, queryFabric, readSyncState, stateDirectory } from "./fabric.mjs";

const statePath = new URL("d365-sync.json", stateDirectory);
const notebookRoot = `/workspaces/${config.workspaceId}/items`;
const fabricOrigin = "https://api.fabric.microsoft.com/v1";
const terminal = new Set(["Completed", "Failed", "Cancelled", "Deduped"]);

export function parseFabricTime(value) {
  if (typeof value !== "string") throw new Error("Missing Fabric job UTC timestamp");
  const timestamp = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid Fabric job UTC timestamp: ${value}`);
  return timestamp;
}

async function saveState(state) {
  await mkdir(stateDirectory, { recursive: true });
  const temporary = new URL(`d365-sync-${process.pid}.tmp`, stateDirectory);
  await writeFile(temporary, JSON.stringify(state, null, 2));
  await rename(temporary, statePath);
}

async function fabricRequest(path, { method = "GET", body } = {}) {
  const url = path.startsWith("https:") ? path : fabricOrigin + path;
  if (!url.startsWith(fabricOrigin + "/")) throw new Error("Unexpected Fabric request destination");
  const token = await credential.getToken("https://api.fabric.microsoft.com/.default");
  for (let attempt = 0; attempt < 4; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method, signal: AbortSignal.timeout(90000),
        headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json", "x-ms-fabric-skill": "spark-authoring-cli" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (error) {
      const transient = ["UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"].includes(error.cause?.code);
      if (method !== "GET" || !transient || attempt === 3) throw error;
      console.warn(`Fabric GET connection interrupted (${error.cause.code}); retry ${attempt + 1}/3.`);
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (method === "GET" && [429, 502, 503, 504].includes(response.status) && attempt < 3) {
      console.warn(`Fabric GET returned HTTP ${response.status}; retry ${attempt + 1}/3.`);
      const retryAfter = Number(response.headers.get("retry-after"));
      await response.text();
      await sleep(Math.min(30000, retryAfter > 0 ? retryAfter * 1000 : 5000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw new Error(`Fabric ${method} ${new URL(url).pathname}: HTTP ${response.status}: ${(await response.text()).slice(0, 1200)}`);
    return response;
  }
  throw new Error("Fabric GET retry budget exhausted");
}

async function monitorJob(jobsRoot, state) {
  state.status = "running";
  await saveState(state);
  for (let attempt = 0; attempt < 120; attempt++) {
    const job = await (await fabricRequest(`${jobsRoot}/${state.jobId}`)).json();
    state.checkedAt = new Date().toISOString();
    state.message = `Fabric Gold refresh job ${state.jobId}: ${job.status}.`;
    await saveState(state);
    if (job.status === "Completed") {
      Object.assign(state, {
        status: "succeeded", digest: state.pendingDigest,
        lastIngestedAt: job.endTimeUtc ? new Date(parseFabricTime(job.endTimeUtc)).toISOString() : new Date().toISOString(),
        message: "D365 account/contact ingestion and Fabric Gold rebuild completed. SQL endpoint propagation may lag."
      });
      delete state.pendingDigest;
      await saveState(state);
      console.log(state.message);
      return state;
    }
    if (terminal.has(job.status)) throw new Error(`Fabric notebook ${job.status}: ${JSON.stringify(job.failureReason)}`);
    await sleep(15000);
  }
  throw new Error(`Fabric job ${state.jobId} is still running after 30 minutes. Inspect that job; do not submit a duplicate.`);
}

async function listItems() {
  const items = [];
  let url = `${notebookRoot}?type=Notebook`;
  while (url) {
    const data = await (await fabricRequest(url)).json();
    items.push(...data.value);
    url = data.continuationUri;
  }
  return items;
}

async function waitOperation(response) {
  if (response.status !== 202) return;
  const operation = response.headers.get("x-ms-operation-id");
  if (!operation) throw new Error("Fabric operation ID was not returned");
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(5000);
    const state = await (await fabricRequest(`/operations/${operation}`)).json();
    if (state.status === "Succeeded") return;
    if (state.status === "Failed") throw new Error(`Notebook deployment failed: ${JSON.stringify(state.error)}`);
  }
  throw new Error(`Notebook deployment timed out; inspect operation ${operation} before retrying`);
}

export async function deployNotebook() {
  const workspace = await (await fabricRequest(`/workspaces/${config.workspaceId}`)).json();
  if (!workspace.capacityId) throw new Error("Fabric workspace has no assigned capacity");
  const capacities = await (await fabricRequest("/capacities")).json();
  if (!capacities.value.some(c => c.id === workspace.capacityId && c.state === "Active")) throw new Error("Assigned Fabric capacity is not active");
  const code = await readFile(new URL("./refresh-customer360.py", import.meta.url), "utf8");
  const cell = (source, metadata = {}) => ({
    cell_type: "code", metadata, source: source.split("\n").map(line => line + "\n"),
    execution_count: null, outputs: []
  });
  const notebook = {
    nbformat: 4, nbformat_minor: 5,
    metadata: {
      kernel_info: { name: "synapse_pyspark" },
      kernelspec: { display_name: "Synapse PySpark", language: "python", name: "synapse_pyspark" },
      language_info: { name: "python" },
      dependencies: { lakehouse: {
        default_lakehouse: config.lakehouseId, default_lakehouse_name: config.lakehouseName,
        default_lakehouse_workspace_id: config.workspaceId
      } }
    },
    cells: [cell('landing_path = ""', { tags: ["parameters"] }), cell(code)]
  };
  const definition = { format: "ipynb", parts: [{
    path: "notebook-content.ipynb", payloadType: "InlineBase64",
    payload: Buffer.from(JSON.stringify(notebook)).toString("base64")
  }] };
  const matches = (await listItems()).filter(item => item.displayName === config.refreshNotebookName);
  if (matches.length > 1) throw new Error("Multiple live refresh notebooks found");
  const existing = matches[0];
  const response = existing
    ? await fabricRequest(`${notebookRoot}/${existing.id}/updateDefinition`, { method: "POST", body: { definition } })
    : await fabricRequest(notebookRoot, { method: "POST", body: {
      displayName: config.refreshNotebookName, type: "Notebook",
      description: "Live Dataverse account/contact updates and derived Gold refresh. Other inputs remain prepared Fabric data.",
      definition
    } });
  await waitOperation(response);
  const found = (await listItems()).filter(item => item.displayName === config.refreshNotebookName);
  if (found.length !== 1) throw new Error("Refresh notebook could not be resolved after deployment");
  console.log(`Refresh notebook ready: ${found[0].id}`);
  return found[0];
}

async function fetchEntity(entity, select, filter, order) {
  const token = await credential.getToken(`${config.dataverseUrl}/.default`);
  const records = [];
  let url = `${config.dataverseUrl}/api/data/v9.2/${entity}?${new URLSearchParams({ $select: select, $filter: filter, $orderby: order })}`;
  while (url) {
    if (!url.startsWith(config.dataverseUrl + "/api/data/")) throw new Error("Unexpected Dataverse paging destination");
    const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { Authorization: `Bearer ${token.token}`, Accept: "application/json" } });
    if (!response.ok) throw new Error(`Dataverse ${entity}: HTTP ${response.status}: ${(await response.text()).slice(0, 600)}`);
    const page = await response.json();
    if (!Array.isArray(page.value)) throw new Error(`Unexpected Dataverse ${entity} response`);
    records.push(...page.value);
    if (records.length > 10000) throw new Error("D365 extraction exceeds POC row limit");
    url = page["@odata.nextLink"];
  }
  return records;
}

async function storageRequest(path, method, query, content) {
  const token = await credential.getToken("https://storage.azure.com/.default");
  const url = `https://onelake.dfs.fabric.microsoft.com/${config.workspaceId}/${config.lakehouseId}/${path}?${query}`;
  const response = await fetch(url, {
    method, body: content, signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${token.token}`, "x-ms-version": "2021-06-08" }
  });
  if (response.status === 409 && query === "resource=directory" && response.headers.get("x-ms-error-code") === "PathAlreadyExists") return;
  if (!response.ok) throw new Error(`OneLake ${method} ${path}: HTTP ${response.status}: ${(await response.text()).slice(0, 600)}`);
}

async function uploadJson(path, data) {
  const bytes = Buffer.from(JSON.stringify(data));
  await storageRequest(path, "PUT", "resource=file");
  await storageRequest(path, "PATCH", "action=append&position=0", bytes);
  await storageRequest(path, "PATCH", `action=flush&position=${bytes.length}`);
}

export async function syncOnce() {
  const previous = await readSyncState();
  let state = { ...previous, status: "running", checkedAt: new Date().toISOString(), message: "Reading D365 account/contact changes." };
  await saveState(state);
  try {
    const names = await queryFabric("SELECT TOP (1001) AccountNumber FROM dbo.silver_d365_accounts ORDER BY AccountNumber");
    const accountNumbers = names.recordset.map(row => row.AccountNumber);
    if (!accountNumbers.length || accountNumbers.length > 1000) throw new Error("Invalid POC account scope");
    const filter = accountNumbers.map(number => `accountnumber eq '${number.replaceAll("'", "''")}'`).join(" or ");
    const accounts = await fetchEntity("accounts", "accountid,accountnumber,name,revenue,address1_city,address1_stateorprovince,address1_country,numberofemployees,modifiedon", filter, "accountid");
    if (accounts.length !== accountNumbers.length || new Set(accounts.map(a => a.accountnumber)).size !== accountNumbers.length) throw new Error("D365 account scope is missing or duplicated; additions/deletions/key changes need explicit onboarding");
    const contactFilter = accounts.map(a => `_parentcustomerid_value eq ${a.accountid}`).join(" or ");
    const contacts = await fetchEntity("contacts", "contactid,_parentcustomerid_value,fullname,jobtitle,emailaddress1,telephone1,modifiedon", contactFilter, "contactid");
    const digest = createHash("sha256").update(JSON.stringify({ accounts, contacts })).digest("hex");
    const lastIngested = Date.parse(previous.lastIngestedAt ?? "");
    if (digest === previous.digest && Number.isFinite(lastIngested) && Date.now() - lastIngested < 15 * 60 * 1000) {
      state = { ...state, status: "idle", checkedAt: new Date().toISOString(), message: "D365 checked; no source changes. Gold refresh is requested after 15 minutes without a rebuild; execution adds latency." };
      await saveState(state);
      console.log(state.message);
      return state;
    }
    const notebooks = (await listItems()).filter(item => item.displayName === config.refreshNotebookName);
    if (notebooks.length !== 1) throw new Error("Run npm run deploy:refresh before starting ingestion");
    const notebook = notebooks[0];
    const jobsRoot = `${notebookRoot}/${notebook.id}/jobs/instances`;
    const jobs = await (await fabricRequest(jobsRoot)).json();
    const ownJob = jobs.value.find(job => job.id === previous.jobId);
    if (ownJob && (!terminal.has(ownJob.status) || (ownJob.status === "Completed" && previous.status === "failed"))) {
      console.log(`Resuming monitoring of existing Fabric job ${ownJob.id}; no new job submitted.`);
      state = { ...state, jobId: ownJob.id, notebookId: notebook.id };
      return await monitorJob(jobsRoot, state);
    }
    const active = jobs.value.find(job => !terminal.has(job.status));
    if (active) throw new Error(`Notebook job ${active.id} is already active and is not owned by this worker. No duplicate submitted.`);
    const recent = jobs.value.find(job => Date.now() - parseFabricTime(job.startTimeUtc) < 5 * 60 * 1000);
    if (recent) {
      if (recent.status !== "Completed") throw new Error(`Recent Fabric job ${recent.id} is ${recent.status}; no retry until the five-minute job guard clears.`);
      state = { ...state, status: "idle", message: `Recent job ${recent.id} (${recent.status}); next source refresh will wait until the five-minute job guard clears.` };
      await saveState(state);
      console.log(state.message);
      return state;
    }
    const run = randomUUID();
    const landingPath = `Files/live_d365/${run}`;
    await storageRequest("Files/live_d365", "PUT", "resource=directory");
    await storageRequest(landingPath, "PUT", "resource=directory");
    const manifest = { extractedAt: new Date().toISOString(), accountNumbers, contactCount: contacts.length };
    await Promise.all([
      uploadJson(`${landingPath}/accounts.json`, accounts),
      uploadJson(`${landingPath}/contacts.json`, contacts),
      uploadJson(`${landingPath}/manifest.json`, manifest)
    ]);
    const response = await fabricRequest(`${jobsRoot}?jobType=RunNotebook`, {
      method: "POST", body: { executionData: {
        parameters: { landing_path: { value: landingPath, type: "string" } },
        configuration: { useStarterPool: true }
      } }
    });
    const location = response.headers.get("location");
    if (!location) throw new Error("Notebook submission returned no job location. Inspect recent jobs before retrying.");
    const jobId = location.split("/").pop();
    state = { ...state, jobId, notebookId: notebook.id, landingPath, pendingDigest: digest, accountCount: accounts.length, contactCount: contacts.length, message: "Fabric notebook is updating Silver accounts/contacts and rebuilding Gold." };
    await saveState(state);
    console.log(`Fabric refresh submitted: ${jobId}`);
    return await monitorJob(jobsRoot, state);
  } catch (error) {
    await saveState({ ...state, status: "failed", checkedAt: new Date().toISOString(), message: error.message });
    throw error;
  }
}

async function acquireLock() {
  await mkdir(stateDirectory, { recursive: true });
  const path = new URL("d365-sync.lock", stateDirectory);
  try {
    const file = await open(path, "wx");
    await file.writeFile(String(process.pid));
    await file.close();
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const pid = Number(await readFile(path, "utf8"));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error("Invalid ingestion lock; inspect .state/d365-sync.lock");
    try { process.kill(pid, 0); } catch (probe) {
      if (probe.code !== "ESRCH") throw probe;
      await unlink(path);
      return acquireLock();
    }
    throw new Error(`D365 ingestion is already running under PID ${pid}`);
  }
  return () => unlink(path);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const release = await acquireLock();
  try {
    if (process.argv.includes("--deploy")) await deployNotebook();
    else if (process.argv.includes("--watch")) {
      console.log("D365 ingestion worker started. Existing-account updates only; no source writes. Stop this process to stop ingestion.");
      while (true) {
        try { await syncOnce(); } catch (error) { console.error("D365 ingestion failed:", error.message); }
        await sleep(config.ingestionPollSeconds * 1000);
      }
    } else await syncOnce();
  } finally { await release(); }
}

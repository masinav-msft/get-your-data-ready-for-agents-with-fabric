import { filterAccounts, summarize, rankAccounts, isActiveBreach, exportCsv } from "/model.mjs";

const $ = selector => document.querySelector(selector);
const embeddedSnapshot = $("#embedded-snapshot");
const hostedDataSource = globalThis.customer360DataSource;
const html = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = value => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const compactMoney = value => value >= 1e6 ? `$${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `$${(value / 1e3).toFixed(value % 1000 ? 1 : 0)}K` : money(value);
const percent = (part, total) => total ? `${(part / total * 100).toFixed(1)}%` : "0%";
const monogram = name => html(name.split(/\s+/).slice(0, 2).map(p => p[0]).join(""));
const empty = text => `<div class="empty">${html(text)}</div>`;
const riskClass = status => status.startsWith("Critical") ? "critical" : status.startsWith("High") ? "high" : /Moderate|Medium/.test(status) ? "moderate" : "healthy";
const chip = status => `<span class="risk-chip ${riskClass(status)}">${html(status)}</span>`;
const accountButton = (account, label = account.AccountName) => `<button class="text-button" data-account="${html(account.AccountNumber)}">${html(label)}</button>`;
let snapshot;
let view = "overview";
let selectedAccount;
let refreshTimer;
let loading = false;

const viewCopy = {
  overview: ["Every account. A clearer picture.", "See the opportunity, understand the risk, and know where to act."],
  accounts: ["Know the customer behind the number.", "A connected briefing across sales, service, policy, and customer risk."],
  pipeline: ["Protect the pipeline. Unlock the next deal.", "Understand exposure, sales stages, and the conversations that matter."],
  service: ["Service signals are business signals.", "Connect active support issues to customer commitments and deal value."],
  sources: ["Trust starts with knowing the source.", "Clear lineage, explicit business definitions, and no hidden claims of live data."]
};

function currentAccounts() {
  const accounts = filterAccounts(snapshot.accounts, {
    search: $("#search").value, industry: $("#industry").value,
    segment: $("#segment").value, focus: $("#focus").value
  });
  if ($("#sort").value === "name") return accounts.sort((a, b) => a.AccountName.localeCompare(b.AccountName));
  if ($("#sort").value === "pipeline") return accounts.sort((a, b) => b.PipelineValueUSD - a.PipelineValueUSD || a.AccountName.localeCompare(b.AccountName));
  return rankAccounts(accounts);
}

function metric(label, value, note, attention = false) {
  return `<article class="metric${attention ? " attention" : ""}"><span class="metric-label">${label}</span><span class="metric-icon" aria-hidden="true">${attention ? "&#8599;" : "&#9671;"}</span><div class="metric-value">${value}</div><small>${note}</small></article>`;
}

function render() {
  if (!snapshot) return;
  const accounts = currentAccounts();
  const totals = summarize(accounts);
  $("#page-title").textContent = viewCopy[view][0];
  $("#page-subtitle").textContent = viewCopy[view][1];
  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
    if (button.dataset.view === view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  for (const name of ["overview", "pipeline", "service", "sources"]) $(`#${name}-view`).hidden = name !== view;
  for (const id of ["filters", "results-meta", "metrics", "accounts-panel"]) $(`#${id}`).hidden = view === "sources";
  $("#export").disabled = view === "sources" || accounts.length === 0;
  $("#results-meta").textContent = `${accounts.length} of ${snapshot.accounts.length} accounts in view. All KPIs, insights, and exports follow these filters.`;
  $("#metrics").innerHTML =
    metric("Annual customer revenue", compactMoney(totals.revenue), `${totals.count} customer accounts; not opportunity revenue`) +
    metric("Open sales pipeline", compactMoney(totals.pipeline), `Sum of ${snapshot.mode === "live" ? "Fabric" : "snapshot"} opportunity values`) +
    metric("Pipeline at risk", compactMoney(totals.atRisk), `${percent(totals.atRisk, totals.pipeline)} of pipeline; Medium + High + Critical`, true) +
    metric("Active SLA breaches", totals.breaches, `${totals.openCases} unresolved support cases`, totals.breaches > 0);

  const highRisk = rankAccounts(accounts).filter(a => a.DatabricksChurnScore >= 65).slice(0, 3);
  $("#priority-panel").innerHTML = `<div class="panel-heading"><div><span class="eyebrow">YOUR NEXT BEST CONVERSATION</span><h2>Renewals that need attention</h2></div><span class="pill">Churn 65+</span></div><div class="priority-content"><p class="priority-caption">Prepared churn scores identify ${totals.highChurn} account${totals.highChurn === 1 ? "" : "s"} with ${compactMoney(totals.highChurnPipeline)} in pipeline.</p>${highRisk.length ? highRisk.map(a => `<div class="priority-item"><span class="account-monogram">${monogram(a.AccountName)}</span><div class="priority-name">${accountButton(a)}<small>${html(a.SLATier)} SLA &middot; ${a.cases.filter(isActiveBreach).length} active breaches</small></div><div class="priority-amount">${compactMoney(a.PipelineValueUSD)}<small>Churn score ${a.DatabricksChurnScore.toFixed(1)} / 100</small></div></div>`).join("") : empty("No accounts with churn scores of 65+ in this selection.")}</div>`;
  const maximumStage = Math.max(...totals.stages.map(s => s.value), 1);
  $("#stage-chart").innerHTML = totals.stages.map(s => `<div class="stage-row"><div class="stage-label"><span>${s.stage} <small class="muted">(${s.count})</small></span><span>${money(s.value)}</span></div><div class="bar-track" role="img" aria-label="${s.stage}: ${money(s.value)}, ${s.count} opportunities"><div class="bar-fill" style="width:${s.value / maximumStage * 100}%"></div></div></div>`).join("");
  $("#weighted").textContent = `Probability-weighted pipeline: ${money(totals.weightedPipeline)}. An estimate from demo win probabilities, not booked revenue.`;
  const closing = totals.stages.find(s => s.stage === "Closing");
  const insights = [
    ["01 / PROTECT RENEWALS", `${compactMoney(totals.highChurnPipeline)} needs a closer look`, `${totals.highChurn} accounts score 65+ for churn. Bring the opportunity, service issue, and approved policy into one customer conversation.`, "churn", "Review high-churn accounts"],
    ["02 / CONNECT SERVICE TO SALES", `${totals.breaches} active SLA breaches`, "See which unresolved cases overlap with open deals, then engage the customer contact and executive sponsor. Breach flags come from the case snapshot.", "sla", "Explore service impact"],
    ["03 / ADVANCE THE PIPELINE", `${compactMoney(closing.value)} in closing-stage deals`, `${closing.count} opportunities are marked Closing. Use the account briefing to understand the customer context before the next deal conversation. No date-based forecast is implied.`, "closing", "Review closing-stage deals"]
  ];
  $("#insights").innerHTML = insights.map(([number, title, description, focus, action]) => `<article class="insight"><span class="insight-number">${number}</span><h3>${title}</h3><p>${description}</p><button class="text-button" data-focus="${focus}">${action} &#8594;</button></article>`).join("");
  renderAccounts(accounts);
  renderPipeline(accounts);
  renderService(accounts);
  renderSources();
}

function renderAccounts(accounts) {
  $("#table-title").textContent = view === "accounts" ? "Your customer portfolio" : "Where to focus next";
  $("#account-rows").innerHTML = accounts.length ? accounts.map(a => `<tr><td><div class="account-cell"><span class="account-monogram" aria-hidden="true">${monogram(a.AccountName)}</span><div>${accountButton(a)}<small>${html(a.Industry)} &middot; ${html(a.CustomerSegment)}</small></div></div></td><td>${money(a.PipelineValueUSD)}</td><td><div class="churn-cell${a.DatabricksChurnScore >= 65 ? " risky" : ""}">${a.DatabricksChurnScore.toFixed(1)}<div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${a.DatabricksChurnScore}%"></div></div></div></td><td class="${a.cases.some(isActiveBreach) ? "breach" : ""}">${a.cases.filter(isActiveBreach).length} active</td><td>${chip(a.AIHealthStatus)}</td><td>${accountButton(a, "View briefing \u2192")}</td></tr>`).join("") : '<tr><td colspan="6" class="empty">No matching customers. Change the filters or select Reset to see the portfolio.</td></tr>';
  $("#table-count").textContent = `${accounts.length} customer accounts`;
}

function renderPipeline(accounts) {
  const rows = accounts.flatMap(a => a.opportunities.map(o => ({ account: a, opportunity: o }))).sort((a, b) => b.opportunity.EstimatedValueUSD - a.opportunity.EstimatedValueUSD);
  $("#pipeline-view").innerHTML = `<div class="panel-heading"><div><span class="eyebrow">DEAL INTELLIGENCE</span><h2>Open opportunities</h2></div><span class="pill">${rows.length} opportunities</span></div><p class="view-intro">Risk is the prepared opportunity classification, not the churn score. Expected close dates are snapshot values, not a current forecast.</p><div class="table-scroll"><table><thead><tr><th scope="col">Opportunity / account</th><th scope="col">Value</th><th scope="col">Stage</th><th scope="col">Win probability</th><th scope="col">Expected close</th><th scope="col">Risk</th></tr></thead><tbody>${rows.length ? rows.map(({ account: a, opportunity: o }) => `<tr><td><strong>${html(o.OpportunityName)}</strong><br>${accountButton(a)}<br><small class="muted">${html(o.RiskReason)}</small></td><td>${money(o.EstimatedValueUSD)}</td><td>${html(o.SalesStage)}</td><td>${o.WinProbabilityPct}%</td><td>${html(o.ExpectedCloseDate)}</td><td>${chip(o.DealRiskStatus)}</td></tr>`).join("") : '<tr><td colspan="6" class="empty">No opportunities match the selected customers.</td></tr>'}</tbody></table></div>`;
}

function renderService(accounts) {
  const rows = accounts.flatMap(a => a.cases.map(c => ({ account: a, serviceCase: c }))).sort((a, b) => Number(isActiveBreach(b.serviceCase)) - Number(isActiveBreach(a.serviceCase)));
  $("#service-view").innerHTML = `<div class="panel-heading"><div><span class="eyebrow">CUSTOMER COMMITMENTS</span><h2>Service cases &amp; SLA exposure</h2></div><span class="pill">${rows.length} cases</span></div><p class="view-intro">Active breach means SLABreached = True and status is not Resolved. Recorded duration is the source ResolutionHours field, not a live running clock.</p><div class="table-scroll"><table><thead><tr><th scope="col">Case / account</th><th scope="col">Priority</th><th scope="col">Status</th><th scope="col">Recorded duration</th><th scope="col">SLA target</th><th scope="col">SLA flag</th></tr></thead><tbody>${rows.length ? rows.map(({ account: a, serviceCase: c }) => `<tr><td><strong>${html(c.CaseNumber)}</strong><br>${html(c.CaseTitle)}<br>${accountButton(a)}</td><td>${html(c.Priority)}</td><td>${html(c.CaseStatus)}</td><td>${c.ResolutionHours} hours</td><td>${c.SLATargetHours} hours</td><td>${c.SLABreached === "True" ? '<span class="risk-chip high">Breached</span>' : '<span class="risk-chip healthy">Not breached</span>'}</td></tr>`).join("") : '<tr><td colspan="6" class="empty">No cases match the selected customers.</td></tr>'}</tbody></table></div>`;
}

function renderSources() {
  $("#sources-view").innerHTML = `<div class="panel-heading"><div><span class="eyebrow">TRANSPARENCY BY DESIGN</span><h2>What is behind the numbers?</h2></div><span class="pill">Local snapshot</span></div><p class="view-intro">${html(snapshot.disclosure)}</p><div class="source-grid"><article class="source-card"><span class="eyebrow">01 / CUSTOMER OPERATIONS</span><h3>D365 / Dataverse</h3><p>Prepared opportunities, service cases, and contacts. Accounts are read from the curated Customer 360 CSV.</p><span class="pill">No live API calls</span></article><article class="source-card"><span class="eyebrow">02 / BUSINESS GOVERNANCE</span><h3>SharePoint policy scenario</h3><p>SLA rules and credit limits are read from a local CSV. The SharePoint URLs in that dataset are not verified and are intentionally not offered as live links.</p><span class="pill">CSV policy data only</span></article><article class="source-card"><span class="eyebrow">03 / PREDICTIVE CONTEXT</span><h3>Databricks churn scenario</h3><p>Churn scores are already in the Gold CSV. This app neither queries a Databricks workspace nor trains or executes an ML model.</p><span class="pill">Prepared scores</span></article></div><div class="lineage">POC CSV snapshots &#8594; validated local API &#8594; calculated KPIs &#8594; business briefings</div><dl class="definition-list"><div><dt>Annual customer revenue</dt><dd>Sum of Gold AnnualRevenueUSD for selected accounts. It is not ARR or recognized revenue unless the source business defines it that way.</dd></div><div><dt>Open pipeline / pipeline at risk</dt><dd>Sum of Silver EstimatedValueUSD. At risk includes Medium Risk, High Risk, and Critical Risk opportunities; it is not probability-weighted.</dd></div><div><dt>High-churn exposure</dt><dd>Opportunity value for accounts with churn score &gt;= 65. Different from opportunity risk: ${money(summarize(snapshot.accounts).highChurnPipeline)} versus ${money(summarize(snapshot.accounts).atRisk)} across the full portfolio.</dd></div><div><dt>SLA breaches</dt><dd>Count of Silver cases flagged True and not Resolved. Policy targets and case targets are displayed as recorded; this app does not infer a live SLA timer.</dd></div><div><dt>Recommendations and credits</dt><dd>Actions are pre-authored Gold values, not generated by AI. Policy credit percentages are demo authorization ceilings, not approved payouts or calculated financial liabilities.</dd></div><div><dt>Files loaded</dt><dd>${snapshot.sources.map(source => `<div class="source-file">${html(source.file)} &middot; ${source.rows} rows</div>`).join("")}</dd></div><div><dt>Fabric production path</dt><dd>This web app is Fabric-ready, not a deployed Fabric-native app. Replace the server snapshot loader with authenticated Fabric SQL endpoint queries returning the same contract. Add Entra sign-in and enforce source-level authorization before any shared deployment.</dd></div></dl>`;
  if (snapshot.mode === "live") {
    $("#sources-view .panel-heading .pill").textContent = "Live Fabric SQL";
    $("#sources-view .lineage").textContent = "D365 account/contact API -> local authenticated ingestion worker -> OneLake staging -> Fabric notebook -> Silver/Gold -> live SQL queries -> dashboard";
    const cards = $("#sources-view").querySelectorAll(".source-card");
    cards[0].querySelector("p").textContent = "D365 account name, whole-dollar revenue, location and employee count, plus contact identity/name/job/email/phone, are ingested for existing curated accounts. Other segmentation and buying-role enrichment is retained. New accounts, key changes and deletions require explicit onboarding.";
    cards[0].querySelector(".pill").textContent = "D365 source refresh worker";
    cards[1].querySelector("p").textContent = "Policy rows are queried live from Fabric. Their original SharePoint documents and upstream refresh are not verified; they remain prepared policy data.";
    cards[1].querySelector(".pill").textContent = "Live table, prepared policy";
    cards[2].querySelector("p").textContent = "Churn scores and actions are queried live from Gold but remain prepared enrichment. No numeric churn-model output was verified in the mirrored Databricks table.";
    cards[2].querySelector(".pill").textContent = "Live Gold, prepared scores";
    const definitions = $("#sources-view .definition-list").children;
    definitions[definitions.length - 2].querySelector("dt").textContent = "Fabric tables queried";
    definitions[definitions.length - 2].querySelector("dd").innerHTML = snapshot.sources.map(source => `<div class="source-file">${html(source.table)} &middot; ${source.rows} rows</div>`).join("");
    definitions[definitions.length - 1].querySelector("dd").textContent = `The backend now queries ${snapshot.workspace} / ${snapshot.lakehouse} using Azure CLI credentials on this computer. The browser refreshes every ${snapshot.refreshSeconds} seconds while visible, pausing while an account briefing is open. D365 checks run every 60 seconds; changed data triggers a Fabric Spark job, with a five-minute submission guard. Gold is also rebuilt at least every 15 minutes while the worker runs. Spark execution and SQL endpoint propagation add latency. This is not a publicly hosted or production-authenticated app.`;
    if (snapshot.hosting === "fabric") {
      $("#sources-view .panel-heading .pill").textContent = "Fabric-hosted app";
      $("#sources-view .lineage").textContent = "Fabric SSO -> delegated read-only lakehouse connector -> validated Silver/Gold -> calculated KPIs -> business briefings";
      cards[0].querySelector("p").textContent = "Accounts, contacts, opportunities and service cases are read from curated Fabric tables. Live table queries do not prove live upstream ingestion; the separate D365 refresh worker still runs on the demo computer.";
      cards[0].querySelector(".pill").textContent = "Curated Fabric tables";
      definitions[definitions.length - 1].querySelector("dt").textContent = "Hosted access boundary";
      definitions[definitions.length - 1].querySelector("dd").textContent = "This is a native Fabric App with protected assets, Fabric SSO, authenticated read-only entities and delegated lakehouse access. Each caller needs app execution and source permissions. It does not implement customer-specific row isolation or establish production readiness. Sharing the URL alone grants no access. Table queries refresh every 60 seconds; upstream source freshness is separate.";
    }
  }
  if (embeddedSnapshot) $("#sources-view .lineage").textContent = "POC CSV snapshots -> validated at build time -> embedded HTML data -> calculated KPIs -> business briefings";
}

function openAccount(id) {
  selectedAccount = snapshot.accounts.find(a => a.AccountNumber === id);
  if (!selectedAccount) throw new Error(`Account ${id} is not available in this snapshot`);
  const a = selectedAccount;
  const policies = a.policies.map(p => `<div class="detail-item"><strong>${html(p.SLATier)} &middot; ${p.TargetResponseHours}-hour response target</strong><p>Executive sponsor: ${html(p.ExecutiveSponsor)}<br>Playbook: ${html(p.RenewalPlaybook)}<br>Maximum authorized credit: ${p.MaxAuthorizedCreditPct}%<br>Compliance framework: ${html(p.ComplianceFramework)}</p></div>`).join("");
  $("#account-detail").innerHTML = `<span class="pill">${html(a.AccountNumber)}</span><h2 id="dialog-title">${html(a.AccountName)}</h2><p class="detail-subtitle">${html(a.Industry)} &middot; ${html(a.CustomerSegment)} &middot; ${html(a.City)}, ${html(a.StateProvince)}</p>${chip(a.AIHealthStatus)}<div class="detail-kpis"><div class="detail-kpi"><small>Annual revenue</small><strong>${compactMoney(a.AnnualRevenueUSD)}</strong></div><div class="detail-kpi"><small>Open pipeline</small><strong>${compactMoney(a.PipelineValueUSD)}</strong></div><div class="detail-kpi"><small>Churn score / 100</small><strong>${a.DatabricksChurnScore.toFixed(1)}</strong></div></div><section class="recommendation"><span class="eyebrow">SUGGESTED NEXT CONVERSATION</span><p>${html(a.AgentRecommendedAction)}</p><small>Prepared demo recommendation from the Gold snapshot. Human review required; no CRM action or credit is executed.</small></section><section class="detail-section"><h3>Sales opportunities</h3>${a.opportunities.map(o => `<div class="detail-item"><strong>${html(o.OpportunityName)}</strong><p>${html(o.OpportunityId)} &middot; ${money(o.EstimatedValueUSD)} &middot; ${html(o.SalesStage)}<br>Expected close: ${html(o.ExpectedCloseDate)} &middot; Win probability: ${o.WinProbabilityPct}%<br>${html(o.DealRiskStatus)}: ${html(o.RiskReason)}</p></div>`).join("") || '<p class="muted">No opportunities recorded.</p>'}</section><section class="detail-section"><h3>Support signals</h3>${a.cases.map(c => `<div class="detail-item"><strong>${html(c.CaseTitle)}</strong><p>${html(c.CaseNumber)} &middot; ${html(c.Priority)} &middot; ${html(c.CaseStatus)}<br>Recorded duration: ${c.ResolutionHours}h &middot; Case SLA target: ${c.SLATargetHours}h<br>SLA flag: ${c.SLABreached === "True" ? "Breached" : "Not breached"} &middot; Module: ${html(c.AffectedModule)}</p></div>`).join("") || '<p class="muted">No support cases recorded.</p>'}</section><section class="detail-section"><h3>Policy &amp; executive ownership</h3>${policies || '<p class="muted">No policy recorded.</p>'}<p class="detail-note">Source: policy CSV. SharePoint documents are not verified. Credit ceilings are not approved payouts.</p></section><section class="detail-section"><h3>People to engage</h3>${a.contacts.map(c => `<div class="detail-item"><strong>${html(c.FullName)}</strong><p>${html(c.JobTitle)} &middot; ${html(c.BuyingRole)}<br>${html(c.Email)}</p></div>`).join("") || '<p class="muted">No contacts recorded.</p>'}<p class="detail-note">Contact details are demo values, not verified customer contact information.</p></section>`;
  $("#account-dialog").showModal();
  if (snapshot.mode === "live") {
    $(".drawer-footer > span").textContent = `Fabric read ${new Date(snapshot.loadedAt).toLocaleTimeString()}. Read-only; no D365 action is sent.`;
    $("#account-detail .recommendation small").textContent = "Prepared recommendation retained in the Fabric Gold table. Human review required; no CRM action or credit is executed.";
    const notes = $("#account-detail").querySelectorAll(".detail-note");
    notes[0].textContent = "Policy read from Fabric; upstream SharePoint documents are unverified. Credit ceilings are not approved payouts.";
    notes[1].textContent = "Contacts read from Fabric and refreshed from the D365 demo tenant by the ingestion worker.";
  } else {
    $(".drawer-footer > span").textContent = "Snapshot only. No action is sent to D365.";
  }
  $("#account-dialog").scrollTop = 0;
}

function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = name;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadBriefing() {
  const a = selectedAccount;
  if (!a) return;
  const text = [
    `CUSTOMER 360 | ${a.AccountName} (${a.AccountNumber})`,
    snapshot.mode === "live" ? "LIVE FABRIC READ - D365 account/contact refresh is separate. Other inputs remain prepared data. No actions have been sent to D365." : "POC SNAPSHOT - Not live. No actions have been sent to D365.",
    `Annual revenue: ${money(a.AnnualRevenueUSD)}`,
    `Open pipeline: ${money(a.PipelineValueUSD)}`,
    `Prepared churn score: ${a.DatabricksChurnScore}/100 | ${a.AIHealthStatus}`,
    "", "PREPARED RECOMMENDATION (human review required)", a.AgentRecommendedAction,
    "", "OPPORTUNITIES",
    ...a.opportunities.map(o => `${o.OpportunityId}: ${o.OpportunityName} | ${money(o.EstimatedValueUSD)} | ${o.SalesStage} | ${o.DealRiskStatus} | Expected close: ${o.ExpectedCloseDate}`),
    "", "SERVICE CASES",
    ...a.cases.map(c => `${c.CaseNumber}: ${c.CaseTitle} | ${c.CaseStatus} | Recorded duration ${c.ResolutionHours}h | Target ${c.SLATargetHours}h | Breached: ${c.SLABreached}`),
    "", `POLICY (${snapshot.mode === "live" ? "Fabric table" : "CSV only"}; SharePoint documents unverified)`,
    ...a.policies.map(p => `${p.SLATier}: ${p.TargetResponseHours}h response target | Sponsor: ${p.ExecutiveSponsor} | Max credit ${p.MaxAuthorizedCreditPct}% (not an approved payout) | ${p.RenewalPlaybook}`),
    "", "DEMO CONTACTS", ...a.contacts.map(c => `${c.FullName} | ${c.JobTitle} | ${c.Email}`),
    "", "SOURCES", ...snapshot.sources.map(s => s.table ?? s.file),
    `Snapshot ${embeddedSnapshot ? "embedded" : "read by app"} at: ${snapshot.loadedAt} (not source refresh time)`
  ].join("\r\n");
  download(text, `${a.AccountNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}-business-briefing.txt`, "text/plain;charset=utf-8");
}

async function load(background = false) {
  if (loading) return;
  loading = true;
  if (!background) $("#app").hidden = true;
  $("#status").hidden = background;
  $("#status").classList.remove("error");
  $("#status").textContent = "Loading and validating customer snapshots...";
  $("#reload").disabled = true;
  $("#export").disabled = true;
  try {
    let payload;
    if (embeddedSnapshot) {
      payload = JSON.parse(embeddedSnapshot.textContent);
    } else if (hostedDataSource) {
      payload = await hostedDataSource.load();
    } else {
      const response = await fetch("/api/snapshot", { signal: AbortSignal.timeout(90000) });
      if (!response.ok) {
        const detail = await response.json();
        throw new Error(`HTTP ${response.status}: ${detail.error}`);
      }
      payload = await response.json();
    }
    if (!["snapshot", "live"].includes(payload.mode) || !Array.isArray(payload.accounts) || !Array.isArray(payload.sources)) throw new Error("Unexpected data API contract");
    snapshot = payload;
    for (const [id, field, label] of [["industry", "Industry", "All industries"], ["segment", "CustomerSegment", "All segments"]]) {
      const previous = $(`#${id}`).value;
      $(`#${id}`).innerHTML = `<option value="">${label}</option>` + [...new Set(snapshot.accounts.map(a => a[field]))].sort().map(v => `<option value="${html(v)}">${html(v)}</option>`).join("");
      if ([...$(`#${id}`).options].some(o => o.value === previous)) $(`#${id}`).value = previous;
    }
    $("#loaded-time").textContent = embeddedSnapshot
      ? `Snapshot embedded ${new Date(snapshot.loadedAt).toLocaleString()} (not source refresh time)`
      : `${snapshot.mode === "live" ? "Fabric queried" : "Snapshot read"} ${new Date(snapshot.loadedAt).toLocaleTimeString()} (not source refresh time)`;
    render();
    if (snapshot.mode === "live") {
      $(".snapshot-tag").textContent = "LIVE FABRIC";
      $(".disclosure > strong").textContent = "Live Fabric queries";
      $(".disclosure > span:not(.status-dot)").textContent = "D365 accounts/contacts refresh separately. Opportunities, cases, policy and churn remain prepared inputs. Auto-refresh: 60s.";
      $(".disclosure .status-dot").style.background = "var(--cp-success)";
      $("#reload").textContent = "Refresh live data";
      $(".page-footer > span:first-child").textContent = `Live: ${snapshot.workspace} / ${snapshot.lakehouse}`;
      if (snapshot.hosting === "fabric") {
        $(".disclosure > strong").textContent = "Fabric-hosted, read-only";
        $(".disclosure > span:not(.status-dot)").textContent = "Fabric SSO and delegated source permissions. Live lakehouse queries; prepared POC inputs are not live upstream feeds. Auto-refresh: 60s.";
        $(".drawer-footer > span").textContent = "Read-only Fabric data. No action is sent to D365.";
        $("#ingestion-status").hidden = true;
      } else {
        const sync = snapshot.sync;
        const stale = !sync?.checkedAt || Date.now() - Date.parse(sync.checkedAt) > 180000;
        $("#ingestion-status").hidden = false;
        $("#ingestion-status").textContent = `D365 ingestion ${stale ? "(worker heartbeat stale or missing)" : `(${sync.status})`}: ${sync?.message ?? "No worker status available"}. Last Gold rebuild: ${sync?.lastIngestedAt ? new Date(sync.lastIngestedAt).toLocaleString() : "not yet recorded"}.`;
        $("#ingestion-status").style.borderColor = stale || sync?.status === "failed" ? "var(--cp-danger)" : "var(--cp-border)";
      }
      if (!refreshTimer) refreshTimer = setInterval(() => {
        if (!document.hidden && !$("#account-dialog").open) load(true);
      }, snapshot.refreshSeconds * 1000);
    }
    $("#status").hidden = true;
    $("#app").hidden = false;
  } catch (error) {
    console.error("Customer Insights loading failed:", error);
    snapshot = undefined;
    $("#app").hidden = true;
    $("#status").hidden = false;
    $("#status").classList.add("error");
    $("#status").textContent = `Unable to load customer data: ${error.message}. ${embeddedSnapshot
      ? "Ask the sender for a rebuilt HTML file, then reopen it."
      : hostedDataSource ? "Use Sign in with Fabric and verify app execution and lakehouse permissions, then retry. No fallback data is displayed."
      : "Check server output, source access and Azure CLI sign-in, then retry. No fallback data is displayed."}`;
  } finally {
    $("#reload").disabled = false;
    loading = false;
  }
}

document.addEventListener("click", event => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.view) { view = target.dataset.view; render(); }
  if (target.dataset.account) openAccount(target.dataset.account);
  if (target.dataset.focus) { $("#focus").value = target.dataset.focus; render(); }
});
$("#filters").addEventListener("submit", event => event.preventDefault());
$("#search").addEventListener("input", render);
for (const id of ["industry", "segment", "focus", "sort"]) $(`#${id}`).addEventListener("change", render);
$("#clear-filters").addEventListener("click", () => { $("#filters").reset(); $("#sort").value = "risk"; render(); });
$("#trust-link").addEventListener("click", () => { view = "sources"; render(); });
$("#reload").addEventListener("click", () => load());
$("#theme").addEventListener("click", () => {
  document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
});
$("#export").addEventListener("click", () => download(exportCsv(currentAccounts()), `customer-360-${snapshot.mode}.csv`, "text/csv;charset=utf-8"));
$("#close-dialog").addEventListener("click", () => $("#account-dialog").close());
$("#account-dialog").addEventListener("keydown", event => {
  if (event.key === "Escape") { event.preventDefault(); $("#account-dialog").close(); }
});
$("#download-brief").addEventListener("click", downloadBriefing);
if (embeddedSnapshot) {
  $("#reload").textContent = "Reload embedded data";
  $(".brand").setAttribute("href", "#main");
  $(".snapshot-tag").textContent = "OFFLINE DEMO";
  $(".disclosure > strong").textContent = "Self-contained demo";
  $(".disclosure > span:not(.status-dot)").textContent = "No server or live connections. Anyone with this file can read the included demo data.";
  $(".page-footer > span:first-child").textContent = "Customer 360 / Offline business insights";
}
await load();

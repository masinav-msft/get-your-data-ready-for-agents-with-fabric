export const isAtRisk = opportunity =>
  ["Critical Risk", "High Risk", "Medium Risk"].includes(opportunity.DealRiskStatus);

export function filterAccounts(accounts, { search = "", industry = "", segment = "", focus = "" } = {}) {
  const query = search.trim().toLowerCase();
  return accounts.filter(account =>
    (!query || `${account.AccountName} ${account.AccountNumber} ${account.Industry}`.toLowerCase().includes(query)) &&
    (!industry || account.Industry === industry) &&
    (!segment || account.CustomerSegment === segment) &&
    (!focus || (
      focus === "risk" ? account.opportunities.some(isAtRisk) :
      focus === "churn" ? account.DatabricksChurnScore >= 65 :
      focus === "sla" ? account.cases.some(isActiveBreach) :
      focus === "closing" ? account.opportunities.some(o => o.SalesStage === "Closing") : false
    ))
  );
}

export const isActiveBreach = serviceCase =>
  serviceCase.SLABreached === "True" && serviceCase.CaseStatus !== "Resolved";

export function summarize(accounts) {
  const opportunities = accounts.flatMap(a => a.opportunities);
  const cases = accounts.flatMap(a => a.cases);
  const sum = (items, field) => items.reduce((total, item) => total + item[field], 0);
  return {
    count: accounts.length,
    revenue: sum(accounts, "AnnualRevenueUSD"),
    pipeline: sum(opportunities, "EstimatedValueUSD"),
    atRisk: sum(opportunities.filter(isAtRisk), "EstimatedValueUSD"),
    weightedPipeline: opportunities.reduce((total, o) => total + o.EstimatedValueUSD * o.WinProbabilityPct / 100, 0),
    breaches: cases.filter(isActiveBreach).length,
    openCases: cases.filter(c => c.CaseStatus !== "Resolved").length,
    highChurn: accounts.filter(a => a.DatabricksChurnScore >= 65).length,
    highChurnPipeline: sum(accounts.filter(a => a.DatabricksChurnScore >= 65).flatMap(a => a.opportunities), "EstimatedValueUSD"),
    averageChurn: accounts.length ? sum(accounts, "DatabricksChurnScore") / accounts.length : null,
    stages: ["Qualification", "Proposal", "Negotiation", "Closing"].map(stage => ({
      stage,
      count: opportunities.filter(o => o.SalesStage === stage).length,
      value: sum(opportunities.filter(o => o.SalesStage === stage), "EstimatedValueUSD")
    }))
  };
}

export function rankAccounts(accounts) {
  return [...accounts].sort((a, b) =>
    b.DatabricksChurnScore - a.DatabricksChurnScore ||
    b.PipelineValueUSD - a.PipelineValueUSD ||
    a.AccountName.localeCompare(b.AccountName)
  );
}

export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (quoted) {
      if (character === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (character === '"') { quoted = false; closed = true; }
      else field += character;
    } else if (character === '"') {
      if (field || closed) throw new Error("Invalid quote in CSV field");
      quoted = true;
    } else if (character === ",") {
      row.push(field); field = ""; closed = false;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(value => value !== "")) rows.push(row);
      row = []; field = ""; closed = false;
    } else {
      if (closed) throw new Error("Unexpected content after quoted CSV field");
      field += character;
    }
  }
  if (quoted) throw new Error("Unterminated quoted CSV field");
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  if (!rows.length) throw new Error("CSV is empty");
  const headers = rows.shift();
  headers[0] = headers[0].replace(/^\uFEFF/, "");
  if (headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error("Invalid CSV headers");
  return rows.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${index + 2} has an unexpected number of fields`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}

export function exportCsv(accounts) {
  const fields = ["AccountNumber", "AccountName", "Industry", "CustomerSegment", "AnnualRevenueUSD", "PipelineValueUSD", "DatabricksChurnScore", "AIHealthStatus", "AgentRecommendedAction"];
  const escape = value => {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [fields.join(","), ...accounts.map(a => fields.map(f => escape(a[f])).join(","))].join("\r\n");
}

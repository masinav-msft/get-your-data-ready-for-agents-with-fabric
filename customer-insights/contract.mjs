export const definitions = {
  accounts: {
    file: "gold_customer_360_ai_ready.csv",
    required: ["AccountNumber", "AccountName", "Industry", "CustomerSegment", "City", "StateProvince", "SLATier", "ExecutiveSponsor", "AIHealthStatus", "AgentRecommendedAction"],
    numeric: ["AnnualRevenueUSD", "PipelineValueUSD", "DatabricksChurnScore"]
  },
  opportunities: {
    file: "silver_d365_opportunities.csv",
    required: ["OpportunityId", "AccountNumber", "OpportunityName", "SalesStage", "ExpectedCloseDate", "DealRiskStatus", "RiskReason"],
    numeric: ["EstimatedValueUSD", "WinProbabilityPct"]
  },
  cases: {
    file: "silver_d365_service_cases.csv",
    required: ["CaseNumber", "AccountNumber", "CaseTitle", "Priority", "CaseStatus", "SLABreached", "AffectedModule", "CreatedDate"],
    numeric: ["ResolutionHours", "SLATargetHours"]
  },
  contacts: {
    file: "silver_d365_contacts.csv",
    required: ["ContactId", "AccountNumber", "FullName", "JobTitle", "Email", "BuyingRole"],
    numeric: []
  },
  policies: {
    file: "silver_sharepoint_sla_policies.csv",
    required: ["PolicyId", "AccountNumber", "SLATier", "ExecutiveSponsor", "RenewalPlaybook", "ComplianceFramework"],
    numeric: ["TargetResponseHours", "MaxAuthorizedCreditPct"]
  }
};

export function validateAndJoin(tables) {
  const entries = Object.entries(definitions).map(([name, definition]) => {
    if (!Array.isArray(tables[name])) throw new Error(`Missing ${name} table`);
    const records = tables[name].map(row => ({ ...row }));
    if (!records.length && name === "accounts") throw new Error(`${definition.file}: no records available`);
    for (const [index, record] of records.entries()) {
      for (const key of [...definition.required, ...definition.numeric]) {
        if (!(key in record) || record[key] == null || String(record[key]).trim() === "") throw new Error(`${definition.file}: row ${index + 2} missing ${key}`);
      }
      for (const key of definition.numeric) {
        const value = Number(record[key]);
        if (!Number.isFinite(value) || value < 0) throw new Error(`${definition.file}: invalid ${key} at row ${index + 2}`);
        record[key] = value;
      }
      for (const key of ["DatabricksChurnScore", "WinProbabilityPct", "MaxAuthorizedCreditPct"]) {
        if (key in record && record[key] > 100) throw new Error(`${definition.file}: ${key} exceeds 100`);
      }
      if (name === "cases") {
        if (typeof record.SLABreached === "boolean") record.SLABreached = record.SLABreached ? "True" : "False";
        if (!["True", "False"].includes(record.SLABreached)) throw new Error(`${definition.file}: invalid breach flag`);
      }
    }
    return [name, records];
  });
  tables = Object.fromEntries(entries);
  const accountIds = new Set(tables.accounts.map(a => a.AccountNumber));
  if (accountIds.size !== tables.accounts.length) throw new Error("Duplicate AccountNumber in Gold data");
  for (const [name, records] of entries.filter(([name]) => name !== "accounts")) {
    const key = { opportunities: "OpportunityId", cases: "CaseNumber", contacts: "ContactId", policies: "PolicyId" }[name];
    if (new Set(records.map(r => r[key])).size !== records.length) throw new Error(`Duplicate identifiers in ${name}`);
    for (const record of records) {
      if (!accountIds.has(record.AccountNumber)) throw new Error(`Orphan ${name} record for ${record.AccountNumber}`);
    }
  }
  return tables.accounts.map(account => {
    const linked = Object.fromEntries(["opportunities", "cases", "contacts", "policies"].map(name =>
      [name, tables[name].filter(row => row.AccountNumber === account.AccountNumber)]
    ));
    const total = linked.opportunities.reduce((sum, o) => sum + o.EstimatedValueUSD, 0);
    if (Math.abs(total - account.PipelineValueUSD) > 0.01) throw new Error(`Gold/Silver pipeline mismatch for ${account.AccountNumber}`);
    return { ...account, ...linked };
  });
}

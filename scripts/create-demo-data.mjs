import { mkdir, writeFile } from "node:fs/promises";

const directory = new URL("../data/csv/", import.meta.url);
const revenue = [4850000, 4000000, 3000000, 2000000, 2000000, 2000000, 3000000, 2000000, 2000000, 2000000, 2000000, 2240000];
const pipeline = [200000, 680000, 520000, 275000, 500000, 350000, 890000, 350000, 400000, 350000, 400000, 615000];
const churn = [35, 82.5, 68, 50, 15, 20, 88, 15, 20, 15, 15, 20.5];
const names = ["Example Retail 01", "Contoso Healthcare", "Fabrikam Manufacturing", "Example Health 04", "Example Logistics 05", "Example Energy 06", "Woodgrove Bank", "Example Software 08", "Example Retail 09", "Example Services 10", "Example Education 11", "Example Technology 12"];
const industries = ["Retail", "Healthcare", "Manufacturing", "Healthcare", "Logistics", "Energy", "Financial Services", "Technology", "Retail", "Services", "Education", "Technology"];
const number = i => `ACC-${1001 + i}`;
const label = i => String(i + 1).padStart(2, "0");
const risk = i => i === 6 ? "Critical Risk" : [1, 2].includes(i) ? "High Risk" : i === 3 ? "Medium Risk" : "Low Risk";
const stage = i => [0, 1, 6].includes(i) ? "Closing" : ["Qualification", "Proposal", "Negotiation"][i % 3];
const health = i => churn[i] >= 80 ? "Critical Churn Risk" : churn[i] >= 65 ? "High Churn Risk" : churn[i] >= 40 ? "Moderate Risk" : "Healthy";

const accounts = names.map((AccountName, i) => ({
  AccountNumber: number(i), AccountName, Industry: industries[i], CustomerSegment: i % 3 === 0 ? "Commercial" : "Enterprise",
  City: "Example City", StateProvince: "Example State", Country: "Example Country",
  AnnualRevenueUSD: revenue[i], EmployeeCount: 100 + i * 50,
  SLATier: i === 6 ? "Platinum" : "Gold",
  PrimaryContactName: `Demo Contact ${label(i)}`, PrimaryContactEmail: `contact${label(i)}@example.invalid`,
  ExecutiveSponsor: `Demo Sponsor ${label(i)}`
}));
const contacts = accounts.map((a, i) => ({
  ContactId: `DEMO-CONTACT-${label(i)}`, AccountNumber: a.AccountNumber, FullName: a.PrimaryContactName,
  JobTitle: "Example Business Sponsor", Email: a.PrimaryContactEmail, Phone: "Not provided",
  BuyingRole: "Executive Decision Maker"
}));
const opportunities = accounts.map((a, i) => ({
  OpportunityId: `DEMO-OPP-${label(i)}`, AccountNumber: a.AccountNumber, OpportunityName: `Synthetic renewal ${label(i)}`,
  SalesStage: stage(i), ExpectedCloseDate: "2027-01-31", DealRiskStatus: risk(i),
  RiskReason: risk(i) === "Low Risk" ? "Synthetic baseline scenario" : "Prepared risk flag; investigate evidence, do not infer causation",
  ProductCode: "DEMO-SUBSCRIPTION", EstimatedValueUSD: pipeline[i], WinProbabilityPct: 60
}));
const caseAccounts = [1, 2, 3, 4, 6, 6, 7, 0, 5, 8];
const cases = caseAccounts.map((accountIndex, caseIndex) => {
  const breached = [0, 1, 4, 5].includes(caseIndex);
  return {
    CaseNumber: `DEMO-CASE-${String(caseIndex + 1).padStart(2, "0")}`,
    AccountNumber: number(accountIndex), CaseTitle: `Synthetic support scenario ${caseIndex + 1}`,
    Priority: breached ? "P1 - Critical" : "P3 - Normal",
    CaseStatus: caseIndex >= 7 ? "Resolved" : breached ? "Escalated" : "Active",
    SLABreached: breached ? "True" : "False", AffectedModule: "Demo service",
    CreatedDate: "2026-11-01", ResolutionHours: breached ? 12 : 2, SLATargetHours: 4
  };
});
const policies = accounts.map((a, i) => ({
  PolicyId: `DEMO-POLICY-${label(i)}`, AccountNumber: a.AccountNumber, SLATier: a.SLATier,
  ExecutiveSponsor: a.ExecutiveSponsor, RenewalPlaybook: "Review evidence with account and service owners; obtain approval before any action.",
  ComplianceFramework: "DEMO ONLY - no certification", TargetResponseHours: 4,
  MaxAuthorizedCreditPct: i === 6 ? 18 : 10,
  SharePointDocUrl: `https://example.invalid/policies/demo-${label(i)}`
}));
const gold = accounts.map((a, i) => ({
  AccountNumber: a.AccountNumber, AccountName: a.AccountName, Industry: a.Industry,
  CustomerSegment: a.CustomerSegment, City: a.City, StateProvince: a.StateProvince,
  AnnualRevenueUSD: a.AnnualRevenueUSD, SLATier: a.SLATier, ExecutiveSponsor: a.ExecutiveSponsor,
  PrimaryOpportunityId: opportunities[i].OpportunityId, PipelineValueUSD: pipeline[i], SalesStage: stage(i),
  TotalServiceCases: cases.filter(c => c.AccountNumber === a.AccountNumber).length,
  SLABreachedCases: cases.filter(c => c.AccountNumber === a.AccountNumber && c.SLABreached === "True" && c.CaseStatus !== "Resolved").length,
  DatabricksChurnScore: churn[i], AIHealthStatus: health(i),
  AgentRecommendedAction: "Prepared demo recommendation: review the customer evidence and obtain human approval before action."
}));
const tables = {
  silver_d365_accounts: accounts, silver_d365_contacts: contacts,
  silver_d365_opportunities: opportunities, silver_d365_service_cases: cases,
  silver_sharepoint_sla_policies: policies, gold_customer_360_ai_ready: gold
};
const escape = value => `"${String(value).replaceAll('"', '""')}"`;
const schema = {};
await mkdir(directory, { recursive: true });
for (const [table, rows] of Object.entries(tables)) {
  const columns = Object.keys(rows[0]);
  const text = [columns.join(","), ...rows.map(row => columns.map(c => escape(row[c])).join(","))].join("\r\n");
  await writeFile(new URL(`${table}.csv`, directory), `${text}\r\n`);
  schema[table] = columns.map(name => ({
    name,
    type: name === "SLABreached" ? "boolean" : typeof rows[0][name] === "number"
      ? ["DatabricksChurnScore", "ResolutionHours", "SLATargetHours"].includes(name) ? "double" : "integer"
      : "string"
  }));
}
await writeFile(new URL("../schema.json", directory), `${JSON.stringify(schema, null, 2)}\n`);
console.log("Created six synthetic tables; no upstream systems or customer exports were read.");

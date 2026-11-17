import { ConnectorsRayfinClient } from "@microsoft/rayfin-client";
import { ensureSignedInWithFabric, initEmbeddedAuth } from "@microsoft/rayfin-auth-provider-fabric";
import { connectorConfig, type Customer360Schema } from "../rayfin/connectors/customer360/schema.js";
import { connectorSnapshot } from "../connector-data.mjs";

declare const __FABRIC_CONFIG__: {
  baseUrl: string;
  publishableKey: string;
  workspaceId: string;
  projectId: string;
};

const client = new ConnectorsRayfinClient<
  Record<string, never>, Record<string, never>, { customer360: Customer360Schema }
>({
  baseUrl: __FABRIC_CONFIG__.baseUrl,
  publishableKey: __FABRIC_CONFIG__.publishableKey,
  authStorage: true,
  connectors: { customer360: connectorConfig }
});

const authOptions = {
  workspaceId: __FABRIC_CONFIG__.workspaceId,
  projectId: __FABRIC_CONFIG__.projectId,
  fabricPortalUrl: "https://app.fabric.microsoft.com",
  returnOrigin: window.location.origin
};

async function load() {
  if (!client.auth.getSession()?.isAuthenticated) throw new Error("Sign in with Fabric to access customer data");
  const source = client.connectors.customer360;
  const [accounts, opportunities, cases, contacts, policies] = await Promise.all([
    source.Account.select(["AccountNumber", "AccountName", "Industry", "CustomerSegment", "City", "StateProvince", "SLATier", "ExecutiveSponsor", "AIHealthStatus", "AgentRecommendedAction", "AnnualRevenueUSD", "PipelineValueUSD", "DatabricksChurnScore"]).first(10001).executePaginated(),
    source.Opportunity.select(["OpportunityId", "AccountNumber", "OpportunityName", "SalesStage", "ExpectedCloseDate", "DealRiskStatus", "RiskReason", "EstimatedValueUSD", "WinProbabilityPct"]).first(10001).executePaginated(),
    source.ServiceCase.select(["CaseNumber", "AccountNumber", "CaseTitle", "Priority", "CaseStatus", "SLABreached", "AffectedModule", "CreatedDate", "ResolutionHours", "SLATargetHours"]).first(10001).executePaginated(),
    source.Contact.select(["ContactId", "AccountNumber", "FullName", "JobTitle", "Email", "BuyingRole"]).first(10001).executePaginated(),
    source.Policy.select(["PolicyId", "AccountNumber", "SLATier", "ExecutiveSponsor", "RenewalPlaybook", "ComplianceFramework", "TargetResponseHours", "MaxAuthorizedCreditPct"]).first(10001).executePaginated()
  ]);
  return connectorSnapshot({ accounts, opportunities, cases, contacts, policies });
}

Object.assign(globalThis, { customer360DataSource: { load } });

const authButton = document.createElement("button");
authButton.className = "button secondary";
authButton.id = "fabric-auth";
const actions = document.querySelector(".topbar-actions");
if (!actions) throw new Error("Missing authentication action container");
actions.prepend(authButton);

function showAuthState() {
  authButton.textContent = client.auth.getSession()?.isAuthenticated ? "Sign out" : "Sign in with Fabric";
}

function showError(error: unknown) {
  console.error("Fabric authentication failed:", error);
  const status = document.querySelector("#status");
  if (status instanceof HTMLElement) {
    status.hidden = false;
    status.classList.add("error");
    status.textContent = `Fabric sign-in failed: ${error instanceof Error ? error.message : String(error)}. No fallback data is displayed.`;
  }
}

authButton.addEventListener("click", async () => {
  authButton.disabled = true;
  try {
    if (client.auth.getSession()?.isAuthenticated) {
      const app = document.querySelector("#app");
      if (app instanceof HTMLElement) app.hidden = true;
      document.querySelector<HTMLDialogElement>("#account-dialog")?.close();
      await client.auth.signOut();
      window.location.reload();
      return;
    }
    await ensureSignedInWithFabric(client.auth, authOptions);
    showAuthState();
    document.querySelector<HTMLButtonElement>("#reload")?.click();
  } catch (error) {
    showError(error);
  } finally {
    authButton.disabled = false;
  }
});

try {
  await initEmbeddedAuth(client.auth, authOptions);
} catch (error) {
  showError(error);
}
showAuthState();
await import("../public/app.mjs");

import { entity, role, text, int, decimal, boolean } from "@microsoft/rayfin-core";
import { Source, type ConnectorConfig } from "@microsoft/rayfin-connectors";
import type { GraphQLBackedConnector } from "@microsoft/rayfin-connector-fabric-graphql";

// The SQL endpoint exposes nullable, keyless tables. Validation rejects incomplete records.
@role("authenticated", ["read"])
@entity()
export class Account extends Source({ schema: "dbo", table: "gold_customer_360_ai_ready" }) {
  @text({ optional: true }) AccountNumber?: string;
  @text({ optional: true }) AccountName?: string;
  @text({ optional: true }) Industry?: string;
  @text({ optional: true }) CustomerSegment?: string;
  @text({ optional: true }) City?: string;
  @text({ optional: true }) StateProvince?: string;
  @text({ optional: true }) SLATier?: string;
  @text({ optional: true }) ExecutiveSponsor?: string;
  @text({ optional: true }) AIHealthStatus?: string;
  @text({ optional: true }) AgentRecommendedAction?: string;
  @int({ optional: true }) AnnualRevenueUSD?: number;
  @int({ optional: true }) PipelineValueUSD?: number;
  @decimal({ optional: true }) DatabricksChurnScore?: number;
}

@role("authenticated", ["read"])
@entity()
export class Opportunity extends Source({ schema: "dbo", table: "silver_d365_opportunities" }) {
  @text({ optional: true }) OpportunityId?: string;
  @text({ optional: true }) AccountNumber?: string;
  @text({ optional: true }) OpportunityName?: string;
  @text({ optional: true }) SalesStage?: string;
  @text({ optional: true }) ExpectedCloseDate?: string;
  @text({ optional: true }) DealRiskStatus?: string;
  @text({ optional: true }) RiskReason?: string;
  @int({ optional: true }) EstimatedValueUSD?: number;
  @int({ optional: true }) WinProbabilityPct?: number;
}

@role("authenticated", ["read"])
@entity()
export class ServiceCase extends Source({ schema: "dbo", table: "silver_d365_service_cases" }) {
  @text({ optional: true }) CaseNumber?: string;
  @text({ optional: true }) AccountNumber?: string;
  @text({ optional: true }) CaseTitle?: string;
  @text({ optional: true }) Priority?: string;
  @text({ optional: true }) CaseStatus?: string;
  @boolean({ optional: true }) SLABreached?: boolean;
  @text({ optional: true }) AffectedModule?: string;
  @text({ optional: true }) CreatedDate?: string;
  @decimal({ optional: true }) ResolutionHours?: number;
  @decimal({ optional: true }) SLATargetHours?: number;
}

@role("authenticated", ["read"])
@entity()
export class Contact extends Source({ schema: "dbo", table: "silver_d365_contacts" }) {
  @text({ optional: true }) ContactId?: string;
  @text({ optional: true }) AccountNumber?: string;
  @text({ optional: true }) FullName?: string;
  @text({ optional: true }) JobTitle?: string;
  @text({ optional: true }) Email?: string;
  @text({ optional: true }) BuyingRole?: string;
}

@role("authenticated", ["read"])
@entity()
export class Policy extends Source({ schema: "dbo", table: "silver_sharepoint_sla_policies" }) {
  @text({ optional: true }) PolicyId?: string;
  @text({ optional: true }) AccountNumber?: string;
  @text({ optional: true }) SLATier?: string;
  @text({ optional: true }) ExecutiveSponsor?: string;
  @text({ optional: true }) RenewalPlaybook?: string;
  @text({ optional: true }) ComplianceFramework?: string;
  @int({ optional: true }) TargetResponseHours?: number;
  @decimal({ optional: true }) MaxAuthorizedCreditPct?: number;
}

export const connectorConfig = {
  connector: "fabric-sqlanalytics",
  operations: ["read"],
  entities: { Account, Opportunity, ServiceCase, Contact, Policy }
} as const satisfies ConnectorConfig;

export type Customer360Schema = GraphQLBackedConnector<
  typeof connectorConfig.entities,
  typeof connectorConfig
>;

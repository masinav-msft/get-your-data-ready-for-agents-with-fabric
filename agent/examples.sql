-- Example 1: account portfolio. Customer annual revenue is not our company's ARR.
SELECT COUNT(*) AS AccountCount,
       SUM(AnnualRevenueUSD) AS AnnualCustomerRevenueUSD,
       SUM(PipelineValueUSD) AS PipelineValueUSD
FROM dbo.gold_customer_360_ai_ready;

-- Example 2: opportunity risk and high-churn exposure use different definitions.
SELECT
    SUM(CASE WHEN o.DealRiskStatus IN ('Medium Risk', 'High Risk', 'Critical Risk')
             THEN o.EstimatedValueUSD ELSE 0 END) AS OpportunityPipelineAtRiskUSD,
    SUM(CASE WHEN g.DatabricksChurnScore >= 65
             THEN o.EstimatedValueUSD ELSE 0 END) AS HighChurnPipelineUSD
FROM dbo.silver_d365_opportunities AS o
JOIN dbo.gold_customer_360_ai_ready AS g ON g.AccountNumber = o.AccountNumber;

-- Example 3: active SLA breaches, not all historically flagged cases.
SELECT COUNT(*) AS ActiveSLABreachedCases
FROM dbo.silver_d365_service_cases
WHERE SLABreached = 1 AND CaseStatus <> 'Resolved';

-- Example 4: overlap without joining raw opportunities to raw cases.
WITH OpportunityRisk AS (
    SELECT AccountNumber, SUM(EstimatedValueUSD) AS AtRiskPipelineUSD
    FROM dbo.silver_d365_opportunities
    WHERE DealRiskStatus IN ('Medium Risk', 'High Risk', 'Critical Risk')
    GROUP BY AccountNumber
), ActiveBreaches AS (
    SELECT AccountNumber, COUNT(*) AS BreachedCases
    FROM dbo.silver_d365_service_cases
    WHERE SLABreached = 1 AND CaseStatus <> 'Resolved'
    GROUP BY AccountNumber
)
SELECT g.AccountNumber, g.AccountName, r.AtRiskPipelineUSD, b.BreachedCases,
       g.DatabricksChurnScore
FROM dbo.gold_customer_360_ai_ready AS g
JOIN OpportunityRisk AS r ON r.AccountNumber = g.AccountNumber
JOIN ActiveBreaches AS b ON b.AccountNumber = g.AccountNumber
ORDER BY r.AtRiskPipelineUSD DESC, g.AccountNumber;

-- Example 5: Woodgrove briefing. A policy ceiling does not approve any action.
SELECT g.AccountNumber, g.AccountName, g.PipelineValueUSD, g.DatabricksChurnScore,
       g.SLABreachedCases, p.MaxAuthorizedCreditPct, p.ExecutiveSponsor,
       p.RenewalPlaybook
FROM dbo.gold_customer_360_ai_ready AS g
JOIN dbo.silver_sharepoint_sla_policies AS p ON p.AccountNumber = g.AccountNumber
WHERE g.AccountNumber = 'ACC-1007';

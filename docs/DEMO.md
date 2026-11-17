# Demo: from data to a business conversation

## Opening talk track

> A sales dashboard can tell us the size of an opportunity. A support system can tell us a customer has unresolved cases. Policy information tells us the boundaries for a response. The problem is connecting those signals before the customer meeting.
>
> This Customer 360 scenario shows how a consistent Fabric data foundation can support a dashboard, a guided application and a conversational Data Agent. Our local demo uses synthetic inputs; it is not a claim that every upstream source is live.

## Local application

1. Show 12 accounts and the portfolio metrics.
2. Explain the difference between $2.365M of opportunity pipeline at risk and $2.09M associated with high-churn-score accounts.
3. Filter to active SLA breaches.
4. Open Woodgrove Bank: $890K opportunity, prepared score 88, two active breached cases and an 18% maximum credit-policy ceiling.
5. Explain that the ceiling is not an approval and the overlap is not causal evidence.
6. Open Data & trust to show source and freshness boundaries.

## Questions for a configured Fabric Data Agent / M365 Copilot

These are prompts to run **after** configuring and testing your agent. The local app does not invoke it.

1. How many accounts do we have, and what are annual customer revenue and open pipeline?
2. How much opportunity pipeline is at risk, using Medium Risk, High Risk and Critical Risk labels?
3. Which customers have both at-risk opportunities and active SLA breaches? Rank by at-risk opportunity value and show the breached cases.
4. For Woodgrove Bank, summarize its opportunity, active breached cases, prepared churn score and applicable policy ceiling.
5. What evidence or approvals are missing before we act?
6. Prepare a short executive briefing. Distinguish source facts, prepared inputs and interpretation.

## Why use M365 Copilot?

> The advantage is not another place to see the same number. It is the ability for a business leader to ask the next question in normal language, investigate the evidence and prepare a briefing in a familiar work experience.
>
> Fabric provides the data foundation. The configured Data Agent provides the query interface. M365 Copilot provides a conversational entry point. The permissions, freshness and correctness still need to be verified.

Power BI remains useful for established metrics and visual analysis. The app supports a guided customer-review workflow. Copilot supports unplanned questions and narrative preparation; it does not replace either experience.

## How is this agent-ready?

Connected customer keys, defined measures, source provenance and curated tables are useful foundations for an agent. The configured Fabric Data Agent can provide read-and-investigate capability.

The next step would be: detect a condition, retrieve evidence, propose a response, obtain approval, execute a narrowly authorized action and audit the result. That orchestration and action layer is **not** implemented here.

## Closing

> This is a working starting point for getting data ready for agents. The business value is connecting signals for a better-informed conversation. Production readiness requires real ingestion, measured freshness, enforced isolation, evaluation and operational ownership.

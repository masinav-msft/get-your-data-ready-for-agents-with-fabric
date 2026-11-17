# Get Your Data Ready for Agents with Fabric

## Dynamics 365, SharePoint & Databricks - 120 attendee FAQs

> Portable repository edition: the FAQs describe the reference POC and its limits. Cloning the repository does not recreate its cloud resources. Repository data is freshly generated synthetic data; configure and verify your own environment.

Prepared 16 November 2026. Product and licensing details can change. This is broad preparation, not exhaustive legal, commercial or security advice.

[Download the Word answer book](Attendee-FAQs.docx)

## 1. Business situation, value and executive questions

### Q001. What business problem are we solving?

People preparing a customer renewal have to reconcile sales opportunities, service incidents, policy limits and customer-risk signals. Our Customer 360 scenario brings that context together so they can identify which account needs attention and prepare a better-informed conversation. It supports human decisions; it does not prove that an intervention will save a deal.

### Q002. Can you explain the use case in five lines?

A valuable customer has an open opportunity. Service cases are breaching commitments. A prepared churn score signals concern. Policy data identifies the sponsor and maximum credit ceiling. Fabric brings those signals into a curated view that people can explore through a dashboard, a business app or a published Data Agent.

### Q003. Why would a CEO, VP or director care?

They need to know where pipeline is exposed, which customer relationships deserve executive attention and what evidence supports prioritization. The demonstration connects those questions to account-level context. Business value should be measured through preparation time, decision turnaround and intervention outcomes, rather than assuming that a dashboard alone increases revenue.

### Q004. Who is the hosted app most useful for?

Account managers and customer-success teams can prepare customer briefings. Sales leaders can prioritize exposed opportunities. Service leaders can relate unresolved issues to customer commitments. Executives can move from portfolio totals to a specific account. Data and application teams can deliver those experiences without requiring every business user to write SQL.

### Q005. What is the Woodgrove Bank story I should remember?

Woodgrove has an $890,000 opportunity, a prepared churn score of 88 and two active SLA-breached cases. Its policy specifies an 18% maximum credit ceiling and Demo Sponsor 07 as executive sponsor. Those facts justify investigation and a coordinated conversation; they do not prove causation or authorize a payout.

### Q006. How is this better than spreadsheets and manually checking CRM?

The intended improvement is consistent definitions and a joined customer context instead of repeatedly assembling extracts by hand. The app also validates relationships and pipeline totals before displaying data. Spreadsheets remain useful for analysis, but downloaded files become separate copies whose access, freshness and redistribution need their own controls.

### Q007. What return on investment can we claim?

We have not measured financial ROI for this POC. Propose a baseline and pilot: compare preparation time per account, time to identify exposed opportunities, analyst effort and adoption. Track renewal or service outcomes with appropriate controls before attributing an improvement to Fabric or AI.

### Q008. Why choose Fabric rather than another platform?

Fabric is a strong candidate when a customer wants integrated analytics, OneLake, Power BI, governed data access and agent-facing experiences within the Microsoft ecosystem. It is not automatically best for every workload. Evaluate existing investments, interoperability, regional availability, operational requirements, skills, licensing and total cost against alternatives.

[S1](https://learn.microsoft.com/en-us/fabric/apps/overview) | [S11](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)

## 2. What this POC actually implements

### Q009. What components have actually been provisioned?

The workspace contains a Customer 360 lakehouse and SQL endpoint, medallion and refresh notebooks, a Databricks mirrored catalog, a semantic model, a Power BI report, an ontology and GraphModel, a published Data Agent, and the native Customer 360 Insights Fabric App. Existence alone does not establish operational completeness or production readiness.

### Q010. Is the app genuinely deployed in Fabric?

Yes. Customer 360 Insights was deployed as a native Fabric App, with item type AppBackend, in AgentReadyFabricDemo. Its authenticated hosted URL was opened and tested against the lakehouse. This is different from the earlier loopback Node server and from publishing an offline HTML snapshot.

[S1](https://learn.microsoft.com/en-us/fabric/apps/overview)

### Q011. What data volumes and headline values were verified?

The verified portfolio has 12 accounts, $31,090,000 annual customer revenue, $5,530,000 open opportunity pipeline, $2,365,000 opportunity pipeline at risk, and four active SLA breaches. The five app tables returned 12 account rows, 12 opportunities, 10 cases, 12 contacts and 12 policies. These are demo observations, not continuously monitored guarantees.

### Q012. Is every upstream source live?

No. Live Fabric queries do not make every upstream feed live. Account and contact refresh from D365 is implemented through a separate local worker and a Fabric notebook. Opportunities, cases, policy rows, numeric churn scores and recommended actions remain prepared or retained POC inputs.

### Q013. What did we verify for the hosted app?

A signed-in browser loaded all 12 accounts and the expected KPIs, opened Woodgrove's briefing and displayed the hosted security disclosures. Anonymous page, JavaScript and connector requests were rejected with HTTP 401. The build/type-check and 20 automated tests passed. A second restricted-user security acceptance test has not been completed.

### Q014. What was repaired in the Data Agent?

The agent previously lacked useful instructions and a direct curated Customer 360 lakehouse source. We added selected lakehouse tables, routing and metric guidance, and five SQL-validated examples, then published and tested answers. Existing mirror and ontology references were preserved. The repair did not certify customer isolation or every possible question.

### Q015. Does the app call the Data Agent or generate AI recommendations?

No. The current app queries curated Fabric tables and calculates KPIs in its existing frontend. It does not invoke the Data Agent, an LLM or a churn model. Recommended actions are prepared values read from Gold. The published Data Agent is a separate conversational experience.

### Q016. Is this production ready?

It is a working demonstration and a useful implementation foundation, not a production certification. Managed ingestion, customer isolation, restricted-user tests, operational monitoring, recovery, load testing, lifecycle controls, compliance review and support ownership still need acceptance. Fabric Apps is in preview, so customers should also review preview suitability and current terms.

[S1](https://learn.microsoft.com/en-us/fabric/apps/overview)

## 3. Source data, provenance and ingestion

### Q017. What are the three business source domains?

The story combines D365/Dataverse customer operations, a SharePoint-style SLA and renewal-policy domain, and Databricks predictive-risk context. In the actual implementation these are not three equally live source connections: D365 accounts/contacts have a refresh path, while policies and numeric churn are prepared data retained in Fabric.

### Q018. Which D365 fields are actually refreshed?

For existing curated accounts, the worker refreshes account name, whole-dollar revenue, location and employee count. Contact identity, name, job title, email and phone are retrieved from Dataverse. Some segmentation, SLA and buying-role enrichment is retained. The app exposes only its selected subset of those fields.

### Q019. How does the implemented D365 refresh work?

A local authenticated worker polls D365, uploads changed extracts into a unique OneLake staging folder and starts the Fabric refresh notebook. The notebook updates Silver and rebuilds Gold while retaining prepared enrichment. This is implemented ingestion code; it should not be presented as a verified native Link to Fabric feed.

### Q020. Is SharePoint connected directly in this POC?

No verified live SharePoint site or document feed is established for the policy scenario. The app reads prepared policy rows stored in Fabric. The original document URLs are unverified and are not offered as live evidence. Production ingestion must validate the actual SharePoint source, permissions, refresh and document ownership.

### Q021. Are the churn scores coming live from Databricks?

The POC has Databricks mirror and shortcut artifacts, but we did not verify the demo's numeric churn-score column in the mirrored churn table. Scores such as 88 are prepared Gold enrichment. Do not equate the presence of a mirrored catalog with proof that the app's numeric score is a live ML output.

### Q022. What are Bronze, Silver and Gold doing here?

They separate ingestion or staging, cleaned business records, and a curated Customer 360 product. Silver contains operational and policy records; Gold combines account context and enrichment for consumption. The names alone do not ensure quality: validation, lineage, access policies and refresh orchestration make the layers useful.

### Q023. What happens when an account is new, renamed or deleted?

The implemented worker is scoped to existing curated account numbers. New account onboarding, changes to account keys and account deletion require explicit mapping and processing decisions. Contact removals for the curated set are reflected by the refresh notebook. Do not promise universal change-data-capture behavior for this custom worker.

### Q024. Can other systems and documents be added?

Yes, as a design extension using supported ingestion, mirroring, shortcuts, APIs or document-processing patterns. Each addition needs its own schema, identity, authorization, quality checks, freshness contract and agent-grounding validation. A connector being available does not mean we already configured and tested that source in this POC.

[S11](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview) | [S12](https://learn.microsoft.com/en-us/fabric/onelake/unify-data)

## 4. OneLake, shortcuts, mirroring and Databricks

### Q025. What does OneLake contribute?

OneLake provides a shared data-lake namespace for Fabric workloads. Teams can consume governed data products without designing every experience around a separate export. It does not automatically clean data, grant users access, make every source real-time or eliminate every physical copy.

[S11](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)

### Q026. What is a OneLake shortcut?

A shortcut references data in another supported location so it can be accessed through OneLake without an additional full copy at the shortcut location. Supported target types, caching and permission behavior matter. A shortcut is not a transformation pipeline or a universal security-policy synchronization mechanism.

[S12](https://learn.microsoft.com/en-us/fabric/onelake/unify-data)

### Q027. Which shortcuts are present in our workspace?

Three were verified: customer churn risk, product dimensions and regional sales data. They point to tables in another workspace/item. Do not assume that the mirrored catalog with a similar name in the demo workspace is necessarily the target of those shortcuts.

### Q028. What is the difference between shortcuts and mirroring?

Shortcuts reference selected data locations. Mirroring integrates a supported external database or catalog and determines whether data is accessed in place or replicated. Database mirroring can maintain a synchronized copy; metadata mirroring can synchronize catalog metadata and reference the underlying data. The exact source determines the behavior.

[S12](https://learn.microsoft.com/en-us/fabric/onelake/unify-data)

### Q029. Does zero-copy mean there is no ETL anywhere?

No. It means a particular access path avoids an additional full copy. You may still need ingestion, cleansing, joins, quality checks, materialized Gold tables or model processing. Our custom D365 staging and notebook transformations are real processing and movement; they should not be described as zero-ETL end to end.

[S12](https://learn.microsoft.com/en-us/fabric/onelake/unify-data)

### Q030. Do Databricks Unity Catalog permissions automatically become Fabric permissions?

Do not assume that catalog mirroring or a shortcut synchronizes every source policy. Verify the supported identity and authorization behavior for the exact path and coordinate source, OneLake, SQL and model permissions. Data access integration and security-policy synchronization are separate architecture concerns.

[S12](https://learn.microsoft.com/en-us/fabric/onelake/unify-data)

### Q031. What happens if the source, shortcut or mirrored item is unavailable?

Freshness or queries can fail depending on the path and any supported cache behavior. A production solution needs clear failure handling, monitoring, refresh-age indicators and recovery procedures. Our app intentionally displays a loading error rather than silently replacing a failed Fabric query with a successful-looking snapshot.

### Q032. Can we mix mirrored, shortcut and physically ingested data?

Yes. A common pattern is to mirror or ingest once and expose selected data products through shortcuts to multiple consumers. Use the best-supported pattern per source, then standardize definitions, access and freshness. These capabilities are complementary rather than mutually exclusive.

[S12](https://learn.microsoft.com/en-us/fabric/onelake/unify-data)

## 5. Freshness, data quality and metric definitions

### Q033. Is the solution live and real-time?

It is a live Fabric-hosted app querying actual Fabric tables, not a fully streaming end-to-end solution. Dashboard polling is every 60 seconds while visible and pauses during an open briefing. Upstream freshness depends on ingestion, notebook execution and SQL propagation; several inputs remain prepared demo data.

### Q034. Does a 60-second refresh mean D365 changes appear within 60 seconds?

No. It is a screen-query interval, not an end-to-end SLA. The worker must be running, source changes must be ingested, the notebook must finish and the SQL endpoint must reflect the updates. Submission guards and platform execution add latency.

### Q035. What do the different timestamps mean?

Source modification time, worker check time, successful Gold publication time and app query time describe different events. A fresh query can return older source data. The hosted app does not invent a local-worker heartbeat it cannot observe. A production freshness display should expose those stages explicitly.

### Q036. What does annual customer revenue mean?

It is the sum of AnnualRevenueUSD stored for the selected customer accounts: $31.09M across the verified portfolio. It is not automatically our company's revenue, ARR, contract value, bookings or recognized revenue. Use the business definition of the source field before interpreting it financially.

### Q037. How are pipeline at risk and high-churn exposure different?

Pipeline at risk is the sum of opportunities classified Medium Risk, High Risk or Critical Risk: $2.365M. High-churn exposure is opportunity value for accounts with churn score at least 65: $2.09M. Those are different selection rules and should not be presented as interchangeable metrics.

### Q038. What is probability-weighted pipeline, and how are SLA breaches counted?

Weighted pipeline sums opportunity value multiplied by its win probability. It is an estimate, not booked revenue. Active SLA breaches count cases where SLABreached is True and status is not Resolved. The app uses recorded case flags and durations, not a newly calculated live SLA clock.

### Q039. Does churn score 88 mean an 88% chance the customer will leave?

Not without a validated model definition and calibration. Here 88 is a prepared risk score on a 0-100 scale. We have not established its probability interpretation, predictive accuracy or a causal relationship to service issues. Present it as a prioritization signal, not a certified prediction.

### Q040. How does the app prevent misleading partial or inconsistent results?

It validates required values, numeric ranges, identifiers, relationships and Gold/Silver pipeline agreement. Missing data, incomplete connector pages or more than 10,000 rows per table cause explicit failure rather than a partial KPI. Larger datasets require server-side aggregation or paging and a revised validation contract.

## 6. Power BI, semantic models and Fabric IQ

### Q041. Why do we need a semantic model?

A semantic model provides shared business definitions, relationships, measures and an authorization surface for analytical consumers. It helps different reports interpret metrics consistently. It is not a substitute for source quality, and its measures affect only consumers that actually query that model.

[S13](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)

### Q042. What is Direct Lake, and does it eliminate every refresh operation?

Direct Lake is a semantic-model storage mode designed to read data from OneLake without the usual full Import copy. It does not eliminate upstream ingestion, Gold publication, metadata synchronization or all model processing considerations. Assess the supported model features and query behavior for the customer's specific design.

[S13](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)

### Q043. Is the current app querying Power BI measures?

No. It uses a read-only lakehouse SQL connector and calculates its existing KPIs from the returned rows. The Power BI semantic model is a separate artifact. If centralized DAX definitions are required for the app, change and test its consumption path rather than assuming that existing model measures already govern it.

### Q044. Is the repaired Data Agent necessarily using the semantic model?

No. We verified direct curated lakehouse tables along with existing mirror and ontology references. Do not claim that every response is executed through the Power BI model or uses its DAX measures. The active source and generated query need to support that claim for the particular question.

### Q045. What is the role of Fabric IQ and the ontology?

The ontology represents business entities and relationships, such as customers, opportunities and service context, so connected experiences can reason with business meaning. It complements analytical models and curated tables. It does not automatically create correct relationships, migrate every permission or make all business questions answerable.

[S14](https://learn.microsoft.com/en-us/fabric/iq/)

### Q046. Does having an ontology mean Fabric IQ is production ready in this POC?

No. The ontology and GraphModel exist, and the agent has an ontology reference. Production readiness still requires validated bindings, relationships, coverage, freshness, permissions and representative questions. Artifact presence is evidence of provisioning, not a complete acceptance test.

### Q047. Why have Power BI, Copilot and a custom app?

Power BI suits analytical reports and exploration. Copilot with the Data Agent supports natural-language questions. The app offers a guided customer workflow: find an account, inspect signals and prepare a briefing. They can complement one another; the custom app is not automatically more valuable than a well-designed report.

### Q048. Will totals always match across the report, app and agent?

Only when they use equivalent definitions, filters, source versions, date assumptions and security context. Differences can be legitimate, especially with RLS. Reconcile the actual source query and metric definition, including risk labels and churn thresholds, rather than asking AI to make the numbers match.

## 7. Fabric Data Agents, grounding and answer quality

### Q049. What is a Fabric Data Agent?

It is a conversational interface over configured Fabric data sources that helps answer data questions using supported query capabilities. It is not automatically an autonomous business-process agent. Source selection, instructions, schema, examples and user permissions determine what it can use.

[S6](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent)

### Q050. Can it answer every question across all three source domains?

No. It can answer questions supported by its selected, accessible data and supported query capabilities. A missing policy document, absent model output, inaccessible table or unsupported metric remains a gap. It should explain missing evidence rather than invent a complete answer.

### Q051. What does grounding mean here?

Grounding means using relevant authorized data and metadata to support an answer rather than relying only on general model knowledge. It improves relevance, but it does not guarantee correctness, complete evidence or immunity to hallucination. Check the source, query, filters, definitions and freshness for material decisions.

[S6](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent)

### Q052. How do instructions and examples improve the agent?

Instructions clarify source routing, metric meanings, provenance boundaries and how to handle missing evidence. Validated examples demonstrate useful query patterns. Our five examples were checked against SQL before publication. Neither instructions nor examples replace data permissions, and they do not ensure correct answers to every new prompt.

### Q053. How was answer quality tested?

We asked actual published-agent questions and compared results with SQL-validated values: account totals, revenue, pipeline, risk exposure, breaches and Woodgrove context. We also checked that it did not invent unavailable churn-model accuracy or a verified live SharePoint feed. A production evaluation set should be broader and repeatable.

### Q054. Can it hallucinate or give a different answer on another attempt?

Yes. Natural-language interpretation and generated explanations can vary. Reduce risk with a curated scope, clear definitions, validated examples, evidence review and regression tests. Use deterministic queries or measures for critical calculations and require human approval for consequential decisions.

### Q055. Can the agent approve credits, update CRM or run a notebook?

Not in this POC. The Data Agent is used for read-only analytical questions. An action-taking solution would need separately designed tools, authorization, approval, validation, audit and recovery controls. A recommendation in an answer is not evidence that an action was executed.

[S6](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent)

### Q056. How should we handle a question the available data cannot answer?

Say what is missing and what would be required. For example, churn-model accuracy requires labeled outcomes, predictions, time windows and an evaluation method that are not established here. An explicit limitation is more trustworthy than a plausible-looking number with no evidence.

## 8. Microsoft 365 Copilot experience

### Q057. Why go to M365 Copilot instead of staying in Fabric?

Business users already work in Microsoft 365 and Teams. Publishing a Fabric Data Agent there lets them ask governed data questions in their normal work context without opening the engineering workspace. The benefit is accessibility and workflow integration, not bypassing Fabric permissions.

[S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot)

### Q058. Does ordinary Copilot Chat automatically know all our Fabric data?

No. For this demonstration, select or @mention the published Fabric Data Agent, or open its dedicated chat. Generic Copilot Chat is not evidence that every Fabric table is connected. The agent must be published, available to the user and authorized for its underlying sources.

[S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot)

### Q059. Who can use the published Fabric Data Agent in M365?

Users need the appropriate Microsoft 365/Copilot entitlement, enabled tenant settings, access to the agent and permission to its underlying sources. Current documentation also requires the same account and tenant across the Fabric Data Agent and Copilot integration. Verify the current licensing and tenant prerequisites for the customer.

[S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot)

### Q060. Does sharing the agent grant access to the data?

No. Recipients need agent access and source access. A user without the required source permission can receive an error, empty results or an incomplete answer. Agent sharing is not a shortcut around source authorization, RLS or CLS.

[S4](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-sharing) | [S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot)

### Q061. Can Copilot combine Fabric results with emails, chats or other context?

The broader Copilot experience can use other context available through its supported tools and the user's permissions. Do not assume that every sentence in a combined answer came directly from Fabric. Ask it to distinguish Fabric facts from interpretation and other sources, and inspect the evidence for important claims.

[S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot) | [S9](https://learn.microsoft.com/en-us/copilot/plan/microsoft-365-copilot-privacy)

### Q062. Can we display charts in M365 Copilot?

Supported Copilot experiences can use code interpreter to visualize returned data. Fabric's native agent charts and M365 chart generation are different experiences, so do not promise identical rendering. Verify availability, returned data, chart labels and aggregation in the actual tenant before the presentation.

[S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot)

### Q063. What are five effective executive prompts?

Ask: What are the account count, annual customer revenue and open pipeline? Which opportunities make up pipeline at risk? Which accounts with churn score at least 65 need attention? Explain Woodgrove's opportunity, breached cases and policy ceiling. What evidence is missing before we approve an intervention? Keep source scope and freshness explicit.

### Q064. Can I trust an answer just because it came through M365 Copilot?

Treat it as permission-aware assistance, not automatic certification of business truth. Review source provenance, calculations, freshness and permissions. Copilot can rephrase or interpret Data Agent output; publishing instructions can reduce variation but cannot guarantee that every response is delivered verbatim.

[S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot)

## 9. Fabric Apps / Rayfin and the hosted customer experience

### Q065. What is Fabric Apps, and what is Rayfin?

Fabric Apps is a preview capability for building and hosting data-driven applications in Fabric. Rayfin is the SDK and CLI foundation used to define app services, permissions and connectors. It is distinct from a Power BI app, which packages analytical content for distribution.

[S1](https://learn.microsoft.com/en-us/fabric/apps/overview)

### Q066. Why is a hosted business app valuable rather than just a website?

Its value is the purpose-built workflow: search for a customer, understand exposure, inspect supporting records and prepare a briefing. Hosting and sign-in make that experience accessible to authorized users. Measure the business outcome; managed hosting alone does not establish ROI.

### Q067. Which parts does Fabric manage and which remain our responsibility?

Fabric provides managed app hosting, HTTPS and Fabric SSO, with supported backend and connector services. We remain responsible for application behavior, data exposure, authorization design, quality, source freshness, testing and operational governance. Our deployment intentionally disables a separate app database and uses the existing lakehouse connector.

[S1](https://learn.microsoft.com/en-us/fabric/apps/overview) | [S2](https://learn.microsoft.com/en-us/fabric/apps/connectors)

### Q068. Did we simply upload the localhost Node server?

No. The original vanilla dashboard was reused, but the hosted path replaces the local Node/Azure CLI transport with Fabric SSO and a read-only SQL analytics connector. The hosting package contains built frontend assets rather than an embedded customer snapshot or developer credentials.

### Q069. Will the hosted app continue working if I close my laptop?

Hosting and read-only access to the existing Fabric tables no longer require the localhost web server. However, the custom D365 ingestion worker still runs on the demo computer. Closing that computer can stop upstream refresh even while the hosted app remains reachable and displays the last published data.

### Q070. Does the app execute business actions or call AI?

No. It reads selected lakehouse data, validates it and presents existing calculations and prepared recommendations. CSV and briefing downloads create files for the user. It does not update D365, approve credits, send messages, invoke an LLM or call the published Data Agent.

### Q071. Can we extend the app with writeback, approvals or an agent?

Potentially, using supported app services or separately secured integrations. First define the action, target system, identity, least-privilege permissions, human approval, idempotency, audit and recovery behavior. Those extensions are not implemented or validated merely because the read-only app is deployed.

### Q072. What should developers know about maintaining this deployment?

Use the version-aligned project dependencies, supported Node runtime, existing deployment registry and protected hosting configuration. Type-check, build, run tests, inspect connector deployment results and verify browser data loading after changes. A top-level deployment success can coexist with a connector warning or failure; inspect the detailed output.

## 10. Identity, access, RLS, CLS and OLS

### Q073. How are authentication and authorization different?

Authentication establishes who the caller is. Authorization decides which app, records, fields and operations that identity may access. A successful Microsoft sign-in does not automatically grant source access or create customer-specific row restrictions. Both layers must be deliberately configured and tested.

[S2](https://learn.microsoft.com/en-us/fabric/apps/connectors) | [S3](https://learn.microsoft.com/en-us/fabric/apps/data-permissions)

### Q074. How do RLS, CLS and OLS differ?

RLS limits rows, such as assigned customers. CLS limits columns, such as contact email or financial details. In Power BI semantic models, restricting tables and columns is generally called OLS. These are enforced data permissions, not just report filters, hidden columns or natural-language instructions.

[S7](https://learn.microsoft.com/en-us/fabric/security/service-admin-row-level-security) | [S8](https://learn.microsoft.com/en-us/fabric/security/service-admin-object-level-security)

### Q075. How do RLS and CLS work through M365 Copilot?

When using the Fabric Data Agent integration, source access and the configured underlying row/column security apply to the caller's queries. The user needs agent and source permission. The enforcement layer depends on whether the selected source is a semantic model, SQL endpoint or another supported item.

[S4](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-sharing) | [S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot)

### Q076. Does Power BI RLS protect our app's direct SQL queries?

No. A rule in a Power BI semantic model does not automatically protect the same records queried through a separate SQL endpoint. Our app uses the lakehouse SQL connector, and the Data Agent also has direct and alternate sources. Secure every actual access path, not only the report model.

### Q077. Why did we explicitly choose delegated connector authentication?

Delegated mode uses each signed-in caller's source permissions. Application mode instead uses the configured app identity, currently described for these SQL connectors as the app owner. Delegation is useful for per-user source enforcement, but it only applies restrictions that actually exist; it does not create an entitlement model.

[S2](https://learn.microsoft.com/en-us/fabric/apps/connectors)

### Q078. Can we enforce app-specific rows and fields?

Fabric Apps supports entity roles, row policies and field include/exclude permissions enforced through its data-access layer. Use server-enforced controls and trusted identity mappings, and test the actual connector path. Hiding a screen column or applying a browser filter does not stop someone from requesting data through an API.

[S2](https://learn.microsoft.com/en-us/fabric/apps/connectors) | [S3](https://learn.microsoft.com/en-us/fabric/apps/data-permissions)

### Q079. Have customer-specific RLS and sensitive-column policies been proved in this POC?

No. We verified protected hosting, authenticated read-only entities, delegated source access and anonymous denial. We have not implemented or demonstrated a complete customer-isolation and role-specific CLS acceptance test across every app and agent source. HTTP 401 for anonymous users is not proof of Customer A versus Customer B isolation.

### Q080. How should we prove that security works?

Use two non-admin restricted users and an unauthorized user. Test permitted and forbidden customers, sensitive fields, totals, alternate agent sources, direct queries and exports. For Power BI model tests, avoid Admin/Member/Contributor accounts because model RLS/OLS does not constrain those edit-capable workspace roles. Repeat tests after permission or source changes.

[S7](https://learn.microsoft.com/en-us/fabric/security/service-admin-row-level-security) | [S8](https://learn.microsoft.com/en-us/fabric/security/service-admin-object-level-security)

## 11. Sharing with peers, customers and shareholders

### Q081. Is the hosted app public?

It has an internet-reachable HTTPS address, but the deployed assets and data are not anonymously accessible. Anonymous page, JavaScript and connector requests were verified to return HTTP 401. Reachability, authentication and authorization are different concepts; a visible URL does not itself grant permission.

### Q082. Can I send the hosted link to colleagues?

Yes, but they must sign in and have app Run and interact permission plus the necessary source/table access. The link alone grants neither. Grant only the required permissions, and do not give workspace Admin, Member or Contributor merely so a colleague can run the app.

[S1](https://learn.microsoft.com/en-us/fabric/apps/overview) | [S2](https://learn.microsoft.com/en-us/fabric/apps/connectors)

### Q083. Can I send it directly to external customers or shareholders?

Do not treat this POC as approved for external sharing. Confirm supported external identity and licensing behavior, tenant policies, legal purpose, app access, source permissions and customer-specific isolation first. For shareholders, consider an explicitly approved aggregate reporting product rather than operational customer and contact data.

### Q084. How should we prevent one customer from seeing another customer's information?

Design a trusted user-to-customer entitlement mapping or a suitably isolated per-customer architecture, then enforce it at every relevant data/API path. Protect child tables, Gold aggregates and alternate agent sources as well as account rows. Browser filters are not isolation, and app access alone is insufficient.

### Q085. Is the offline HTML safe to share because it has no login?

It contains the complete embedded demo snapshot, including demo contact data, and anyone holding it can inspect that data. It is a convenient offline demonstration, not governed live access. Review and sanitize its contents before distribution; report filters do not restrict access to the embedded records.

### Q086. Do exports and briefings stay protected by RLS after download?

The export should contain only data authorized at the time it is produced, but a downloaded file is a new copy. Revoking source access does not erase it. Apply appropriate labeling, storage, sharing, retention and handling policies; do not assume the app automatically applies persistent protection to CSV or text downloads.

### Q087. What happens when someone forwards the link or leaves the company?

A forwarded protected link does not confer access. Identity and item/source authorization must still succeed. Use documented offboarding and revocation procedures and test propagation and session behavior; do not promise instantaneous removal from all caches, screenshots, downloads or previously shared conversations.

### Q088. Can a user's job title automatically determine access?

No. CEO, VP, account manager or shareholder are business labels, not an authorization implementation. Access must come from explicit, governed identity/group/role assignments and entitlement rules. Even executives should receive only the access justified by policy and business purpose.

## 12. Privacy, compliance, responsible AI and guardrails

### Q089. Are organizational prompts and responses used to train foundation models?

Microsoft documents that prompts, responses and organizational data covered by its Microsoft 365 Copilot enterprise protections are not used to train foundation models. This does not mean nothing is processed or stored. Use the appropriate commercial identity, review current service terms, and separately assess third-party agents or extensions.

[S9](https://learn.microsoft.com/en-us/copilot/plan/microsoft-365-copilot-privacy) | [S10](https://learn.microsoft.com/en-us/copilot/plan/enterprise-data-protection)

### Q090. Are prompts and answers stored, retained or auditable?

They can be. Microsoft 365 governance supports retention, audit and eDiscovery scenarios, subject to service capabilities, licensing and configuration. Do not say that a private chat is unrecorded or inaccessible to authorized compliance processes. Define the organization's retention and investigation requirements explicitly.

[S9](https://learn.microsoft.com/en-us/copilot/plan/microsoft-365-copilot-privacy)

### Q091. Does everything remain inside Fabric's region and compliance boundary?

Do not make that blanket claim. Microsoft specifically notes that Data Agent responses sent to Microsoft Copilot may be processed or stored outside Fabric's compliance boundary or geographic region under Copilot's terms. Review tenant AI settings, regional commitments, subprocessors and the exact customer requirements.

[S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot) | [S15](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-tenant-settings)

### Q092. Does enterprise data protection mean hallucinations are impossible?

No. Privacy, security, access enforcement and answer correctness are different controls. Grounding and safety measures reduce risks, but important claims still need evidence review and evaluation. Use deterministic calculations and human review for financial, legal, regulatory or customer-impacting decisions.

[S9](https://learn.microsoft.com/en-us/copilot/plan/microsoft-365-copilot-privacy) | [S10](https://learn.microsoft.com/en-us/copilot/plan/enterprise-data-protection)

### Q093. Can prompt injection or a malicious document bypass our controls?

No system should be described as immune to attack. Combine platform defenses with least privilege, restricted sources, no unnecessary action tools, separation of data from instructions and evaluation of adversarial prompts. Backend authorization must hold even when a model generates an unexpected query; prompt wording is not the security boundary.

[S9](https://learn.microsoft.com/en-us/copilot/plan/microsoft-365-copilot-privacy)

### Q094. Can we claim GDPR, financial-services or healthcare compliance from this demo?

No. Platform compliance commitments are relevant inputs, not certification of the customer's solution or data processing. Assess lawful purpose, minimization, residency, access, retention, records of processing, sensitive data and sector-specific obligations with the customer's compliance and legal teams. The demo has not completed that review.

### Q095. Are sensitivity labels, DLP and masking the same as access control?

No. Classification, DLP, masking, encryption and authorization solve different problems and have feature-specific enforcement boundaries. A label does not automatically configure SQL RLS, and visual masking does not necessarily remove permission to read underlying data. Validate the actual services and paths used, including exports and agent interactions.

### Q096. What are the minimum human guardrails for this use case?

Treat recommendations as advisory, show source and freshness limitations, require evidence checks and approval for credits or customer communications, and log consequential actions if later added. An 18% policy ceiling is not approval to issue an 18% credit. Do not infer causation or model accuracy from the prepared churn score.

## 13. Licensing, capacity, costs and commercial questions

### Q097. Which licenses do users need?

Requirements differ across Fabric capacity, Power BI distribution, Fabric Data Agents, M365 Copilot/Chat and app consumption. Current Data Agent-in-Copilot documentation lists its capacity, tenant, account and user-license prerequisites. Confirm the exact purchased plans and current terms instead of applying one licensing rule to every experience.

[S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot) | [S16](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)

### Q098. Does every attendee need a Fabric workspace role?

Not necessarily. Consumers should receive the minimum supported item and source permissions for the chosen experience. For example, current Data Agent documentation says semantic-model Read is sufficient for agent queries without workspace access. That does not automatically define the separate permission requirements of a Fabric Apps connector.

[S4](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-sharing) | [S2](https://learn.microsoft.com/en-us/fabric/apps/connectors)

### Q099. Is Build permission required for all semantic-model access?

No universal answer applies to every route. Current Data Agent documentation says Read is sufficient for semantic-model queries through that agent. Fabric Apps semantic-model connector documentation calls for the caller's applicable model permissions, including Build. Match the requirement to the exact integration rather than copying permissions between products.

[S4](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-sharing) | [S2](https://learn.microsoft.com/en-us/fabric/apps/connectors)

### Q100. Does the hosted app cost nothing because the data is already in Fabric?

No. Fabric Apps services consume capacity units, and source queries, storage, ingestion and other services can contribute costs. Existing capacity may absorb a pilot, but that is not a free-service guarantee. Measure incremental usage and assess the concurrency and refresh pattern expected in production.

[S1](https://learn.microsoft.com/en-us/fabric/apps/overview)

### Q101. Can we promise there is no additional AI or agent charge?

No blanket promise is justified. The current custom app itself makes no AI calls, but the separate agent and Copilot experiences have their own licensing and metering conditions. Confirm the applicable capacity, agent, Copilot and any external-model charges from current commercial documentation before quoting a customer.

### Q102. How should we estimate the total cost?

Include capacity utilization, source-system and network costs where applicable, OneLake storage, ingestion and transformation, query frequency, app/agent concurrency, user licensing, monitoring and support. Pilot with representative workloads and examine capacity metrics. A 12-account demonstration cannot establish a production cost or capacity SKU.

### Q103. Can existing Microsoft 365, Power BI or Databricks investments be reused?

Potentially. Fabric can complement those investments, but a license for one product does not imply entitlement to every feature in another. Reuse semantic definitions, governed data products and existing identity groups where appropriate, then validate integration, permissions, regional support and incremental commercial requirements.

[S1](https://learn.microsoft.com/en-us/fabric/apps/overview) | [S16](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)

### Q104. What performance or availability SLA can I promise?

None was established by this POC beyond the observed tests. The 60-second poll is not a latency or availability SLA. Review current service and preview terms, and measure realistic load, startup, source latency and recovery before agreeing on response-time or freshness objectives.

[S1](https://learn.microsoft.com/en-us/fabric/apps/overview)

## 14. Development to production, scale and operations

### Q105. What is the recommended path from this demo to production?

Confirm the business scope and data contract; replace demo inputs with validated feeds; implement end-to-end authorization; establish evaluations, tests and monitoring; deploy through controlled development, test and production environments; and obtain operational and compliance acceptance. Keep the guided app and agent scope narrow until those controls are proved.

### Q106. How do we remove the dependency on the presenter's laptop?

Move the D365 ingestion process to an appropriate managed, scheduled or event-driven service with supported noninteractive identity. Preserve its validation, idempotency and refresh behavior, add monitoring and recovery, and test source permissions. Hosting the frontend in Fabric did not migrate the custom ingestion worker.

### Q107. How should identity and secrets be managed in production?

Use supported workload identities and secure secret management for the exact source and execution service. Do not deploy a personal Azure CLI login as a production ingestion identity. Keep developer tokens, SQL secrets and privileged keys out of frontend assets; a publishable client key is not a substitute for user authorization.

[S1](https://learn.microsoft.com/en-us/fabric/apps/overview) | [S2](https://learn.microsoft.com/en-us/fabric/apps/connectors)

### Q108. How should we handle dev, test, production and CI/CD?

Separate environments and identities, parameterize approved item references, version code and definitions, and require validation before promotion. Choose supported Git, deployment-pipeline and CLI/API capabilities per item type; do not assume all Fabric artifacts have identical lifecycle support. Protect production data from seed notebooks and unreviewed deployment scripts.

### Q109. What tests should block a production release?

Require source-contract and metric tests, ingestion/recovery tests, restricted-user row/field tests across all paths, agent accuracy and missing-evidence tests, browser/API tests, dependency checks and representative load tests. Reconcile totals under the same permissions and freshness. The existing 20 application tests are a baseline, not a complete production test suite.

### Q110. How should we scale beyond 12 accounts?

Move large calculations and filtering to an appropriate server-side or semantic query layer, add paging or aggregation and validate concurrency and query plans. The current app intentionally fails above 10,000 rows per table or on incomplete pages. Do not remove that guard and claim that larger totals remain correct.

### Q111. What should operations monitor?

Monitor source connectivity, ingestion outcomes, Gold publication age, SQL availability, connector and app errors, authentication failures, capacity saturation and agent answer-quality regressions. Assign ownership and alert thresholds for each stage. Distinguish stale data from a broken app and from a denied user request.

### Q112. How do rollback, disaster recovery and change management work?

Define recovery objectives, version deployable assets, preserve tested source/definition backups and rehearse rollback without overwriting newer valid data. Check the platform's supported backup and recovery features per item. The app's deployment registry helps target an existing item; it is not a comprehensive disaster-recovery strategy.

## 15. Live-demo challenges, troubleshooting and difficult questions

### Q113. What should I show first to make the audience curious?

Start with Woodgrove's $890K opportunity and ask what a sales-only view would miss. Reveal the two breached cases, risk score and policy ceiling, then show the joined briefing. State that the score and policy are prepared demo enrichment. Curiosity should come from the business problem, not an exaggerated live-data claim.

### Q114. What do I say if a peer receives Access denied?

Explain that the protected URL does not grant authorization. Check the account and tenant, app execution permission, source/table access and any applicable row/field rules. Do not solve a consumer-access problem by granting broad workspace administration. A correct denial can be evidence that the boundary is working.

### Q115. What if the Data Agent is missing or still gives an old answer?

Check publication to the agent store, tenant settings, the signed-in account and user/source permissions. Select the intended agent rather than generic chat and start a fresh conversation after configuration changes. Then inspect the actual source and query; do not repeatedly reword a prompt to conceal a data or configuration fault.

[S5](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot)

### Q116. What if the app loads but has no data or reports a connector error?

Check the detailed deployment results, connector compilation/application status, current session and delegated source permissions. Our initial deployment demonstrated that static hosting can succeed while a connector fails; after correcting its compiler configuration we reapplied it and verified real browser data. Never present an empty fallback as success.

### Q117. What if the numbers differ from the slides or an earlier chat?

Compare the actual query, risk labels, churn threshold, source version, filtering, security context and freshness. In this POC the exact opportunity labels include the word Risk, and high-churn exposure differs from opportunity pipeline at risk. Explain the difference openly and validate the result rather than choosing the more attractive number.

### Q118. Can we prove the churn prediction is accurate or that SLA issues caused churn?

Not from this dataset. That requires an actual model, labeled outcomes, evaluation windows, calibration and appropriate causal or experimental analysis. Our risk score and recommendations are prepared context. The correct demonstration claim is that combining signals improves visibility for human review, not that predictive or causal accuracy was established.

### Q119. What is the safest answer when I do not know a product limitation or price?

Say: I do not want to overstate that. This is what we verified in the demonstration; I will confirm the current documentation, tenant capability and commercial terms for your exact scenario. Capture the question and owner. Avoid turning a plausible future extension into a claim that it already exists.

### Q120. What is the strongest honest closing statement?

Fabric can connect governed data, shared business meaning and accessible experiences across reports, agents and apps. This POC demonstrates a working hosted customer briefing and tested data questions. The next step is a scoped customer pilot with real feeds, explicit isolation, measurable outcomes and production acceptance, not a claim that every integration and control is already complete.

## Official references

- **S1:** [What is Fabric Apps (Preview)?](https://learn.microsoft.com/en-us/fabric/apps/overview)
- **S2:** [Connect Fabric Apps to Fabric data](https://learn.microsoft.com/en-us/fabric/apps/connectors)
- **S3:** [Define Fabric Apps data permissions](https://learn.microsoft.com/en-us/fabric/apps/data-permissions)
- **S4:** [Fabric data agent sharing and permission management](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-sharing)
- **S5:** [Consume Fabric data agent in Microsoft Copilot](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-microsoft-365-copilot)
- **S6:** [Fabric data agent concepts](https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent)
- **S7:** [Row-level security with Power BI](https://learn.microsoft.com/en-us/fabric/security/service-admin-row-level-security)
- **S8:** [Object-level security with Power BI](https://learn.microsoft.com/en-us/fabric/security/service-admin-object-level-security)
- **S9:** [Data, privacy and security for Microsoft Copilot](https://learn.microsoft.com/en-us/copilot/plan/microsoft-365-copilot-privacy)
- **S10:** [Enterprise data protection in Microsoft Copilot and Copilot Chat](https://learn.microsoft.com/en-us/copilot/plan/enterprise-data-protection)
- **S11:** [What is OneLake?](https://learn.microsoft.com/en-us/fabric/onelake/onelake-overview)
- **S12:** [Unify data with OneLake shortcuts and mirroring](https://learn.microsoft.com/en-us/fabric/onelake/unify-data)
- **S13:** [Direct Lake overview](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)
- **S14:** [Fabric IQ documentation](https://learn.microsoft.com/en-us/fabric/iq/)
- **S15:** [Fabric data agent tenant settings](https://learn.microsoft.com/en-us/fabric/data-science/data-agent-tenant-settings)
- **S16:** [Microsoft Fabric licenses](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)

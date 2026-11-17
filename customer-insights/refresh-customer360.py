import json
import re
import notebookutils
from datetime import datetime, timezone
from delta.tables import DeltaTable
from pyspark.sql import functions as F, types as T
from pyspark.sql.window import Window

context = notebookutils.runtime.context
table_root = (
    f"abfss://{context['defaultLakehouseWorkspaceId']}@onelake.dfs.fabric.microsoft.com/"
    f"{context['defaultLakehouseId']}/Tables"
)

def read_table(name):
    return spark.read.format("delta").load(f"{table_root}/{name}")

def delta_table(name):
    return DeltaTable.forPath(spark, f"{table_root}/{name}")

if not re.fullmatch(r"Files/live_d365/[a-f0-9-]{36}", landing_path):
    raise ValueError("A unique validated landing_path is required")

manifest = json.loads(notebookutils.fs.head(f"{landing_path}/manifest.json", 1048576))
account_schema = T.StructType([
    T.StructField(name, T.StringType()) for name in [
        "accountid", "accountnumber", "name", "address1_city",
        "address1_stateorprovince", "address1_country", "modifiedon"
    ]
] + [T.StructField("revenue", T.DoubleType()), T.StructField("numberofemployees", T.LongType())])
contact_schema = T.StructType([
    T.StructField(name, T.StringType()) for name in [
        "contactid", "_parentcustomerid_value", "fullname", "jobtitle",
        "emailaddress1", "telephone1", "modifiedon"
    ]
])
raw_accounts = spark.read.schema(account_schema).option("multiLine", True).json(f"{landing_path}/accounts.json")
raw_contacts = spark.read.schema(contact_schema).option("multiLine", True).json(f"{landing_path}/contacts.json")
account_records = [row.asDict() for row in raw_accounts.collect()]
contact_records = [row.asDict() for row in raw_contacts.collect()]
scope = set(manifest["accountNumbers"])
if len(account_records) != len(scope) or {a["accountnumber"] for a in account_records} != scope:
    raise ValueError("Incomplete or duplicate Dataverse account extract; refusing to publish")
if len(contact_records) != manifest["contactCount"]:
    raise ValueError("Contact extract does not match the manifest")
for row in account_records:
    if not row["name"] or row["revenue"] is None or row["revenue"] < 0 or row["revenue"] != int(row["revenue"]):
        raise ValueError("Account name and non-negative whole-dollar revenue are required by the existing schema")

old_accounts = read_table("silver_d365_accounts")
old_account_records = [row.asDict() for row in old_accounts.collect()]
if {a["AccountNumber"] for a in old_account_records} != scope:
    raise ValueError("Curated account scope changed since extraction")
old_contacts = read_table("silver_d365_contacts")
old_contact_records = [row.asDict() for row in old_contacts.collect()]
gold_table = read_table("gold_customer_360_ai_ready")
previous_gold = spark.createDataFrame(gold_table.collect(), schema=gold_table.schema)
source_by_number = {a["accountnumber"]: a for a in account_records}
number_by_id = {a["accountid"]: a["accountnumber"] for a in account_records}
old_by_email = {(c["AccountNumber"], (c["Email"] or "").lower()): c for c in old_contact_records}
updated_accounts = []
for existing in old_account_records:
    source = source_by_number[existing["AccountNumber"]]
    updated = dict(existing)
    for destination, key in {
        "AccountName": "name", "AnnualRevenueUSD": "revenue", "City": "address1_city",
        "StateProvince": "address1_stateorprovince", "Country": "address1_country",
        "EmployeeCount": "numberofemployees"
    }.items():
        if source[key] is None:
            raise ValueError(f"Dataverse {key} is null for {existing['AccountNumber']}; schema mapping needs review")
        updated[destination] = int(source[key]) if destination in ("AnnualRevenueUSD", "EmployeeCount") else source[key]
    updated_accounts.append(updated)

updated_contacts = []
for source in contact_records:
    if source["_parentcustomerid_value"] not in number_by_id:
        raise ValueError("Contact has an unexpected parent account")
    number = number_by_id[source["_parentcustomerid_value"]]
    previous = old_by_email.get((number, (source["emailaddress1"] or "").lower()))
    for field in ("contactid", "fullname", "jobtitle", "emailaddress1"):
        if not source[field]:
            raise ValueError(f"Dataverse contact {field} is missing; schema mapping needs review")
    updated_contacts.append({
        "ContactId": source["contactid"], "AccountNumber": number, "FullName": source["fullname"],
        "JobTitle": source["jobtitle"], "Email": source["emailaddress1"], "Phone": source["telephone1"],
        "BuyingRole": previous["BuyingRole"] if previous else "Not specified in D365"
    })
if len({c["ContactId"] for c in updated_contacts}) != len(updated_contacts):
    raise ValueError("Duplicate Dataverse contact identifiers")

account_updates = spark.createDataFrame(updated_accounts, old_accounts.schema)
contact_updates = spark.createDataFrame(updated_contacts, old_contacts.schema)
delta_table("silver_d365_accounts").alias("target").merge(
    account_updates.alias("source"), "target.AccountNumber = source.AccountNumber"
).whenMatchedUpdateAll().execute()
delta_table("silver_d365_contacts").alias("target").merge(
    contact_updates.alias("source"), "target.ContactId = source.ContactId"
).whenMatchedUpdateAll().whenNotMatchedInsertAll().whenNotMatchedBySourceDelete().execute()

accounts = read_table("silver_d365_accounts").alias("a")
opportunities = read_table("silver_d365_opportunities")
cases = read_table("silver_d365_service_cases")
policies = read_table("silver_sharepoint_sla_policies").alias("p")
if policies.groupBy("AccountNumber").count().filter("count > 1").count():
    raise ValueError("Multiple policies per account require an explicit active-policy rule")
if accounts.join(policies, "AccountNumber", "left_anti").count():
    raise ValueError("Missing policy for an account")
pipeline = opportunities.groupBy("AccountNumber").agg(F.sum("EstimatedValueUSD").alias("PipelineValueUSD"))
ranked = opportunities.withColumn("rank", F.row_number().over(
    Window.partitionBy("AccountNumber").orderBy(F.desc("EstimatedValueUSD"), F.asc("OpportunityId"))
)).filter("rank = 1").select("AccountNumber", F.col("OpportunityId").alias("PrimaryOpportunityId"), "SalesStage")
case_summary = cases.groupBy("AccountNumber").agg(
    F.count("*").alias("TotalServiceCases"),
    F.sum(F.when((F.col("SLABreached") == True) & (F.col("CaseStatus") != "Resolved"), 1).otherwise(0)).alias("SLABreachedCases")
)
enrichment = previous_gold.select("AccountNumber", "DatabricksChurnScore", "AIHealthStatus", "AgentRecommendedAction")
if accounts.join(enrichment, "AccountNumber", "left_anti").count():
    raise ValueError("Missing prepared churn enrichment; new-account onboarding is required")
gold = accounts.join(policies.select("AccountNumber", "SLATier", "ExecutiveSponsor"), "AccountNumber").select(
    F.col("a.AccountNumber").alias("AccountNumber"), "a.AccountName", "a.Industry", "a.CustomerSegment",
    "a.City", "a.StateProvince", "a.AnnualRevenueUSD", "p.SLATier", "p.ExecutiveSponsor"
).join(pipeline, "AccountNumber", "left").join(ranked, "AccountNumber", "left").join(
    case_summary, "AccountNumber", "left"
).join(enrichment, "AccountNumber").fillna({
    "PipelineValueUSD": 0, "TotalServiceCases": 0, "SLABreachedCases": 0, "SalesStage": "No open opportunity"
}).select(*[field.name for field in gold_table.schema.fields])
if gold.count() != len(scope):
    raise ValueError("Gold account count changed unexpectedly")
delta_table("gold_customer_360_ai_ready").alias("target").merge(
    gold.alias("source"), "target.AccountNumber = source.AccountNumber"
).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
print(json.dumps({
    "status": "succeeded", "accounts": len(scope), "contacts": len(updated_contacts),
    "completedAt": datetime.now(timezone.utc).isoformat(),
    "sourceReadAt": manifest["extractedAt"],
    "scope": "Existing account attributes and contacts from D365; other business inputs retained from Fabric"
}))

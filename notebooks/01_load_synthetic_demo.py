import json
from functools import reduce
import notebookutils
from pyspark.sql import functions as F, types as T

# Change only after reviewing the attached default lakehouse.
confirm_synthetic_demo_load = False
if not confirm_synthetic_demo_load:
    raise ValueError("Review the dedicated demo lakehouse, then set confirm_synthetic_demo_load = True")

expected_counts = {
    "silver_d365_accounts": 12,
    "silver_d365_contacts": 12,
    "silver_d365_opportunities": 12,
    "silver_d365_service_cases": 10,
    "silver_sharepoint_sla_policies": 12,
    "gold_customer_360_ai_ready": 12,
}
schema_data = json.loads(notebookutils.fs.head("Files/agent-ready-demo/schema.json", 1048576))
if set(schema_data) != set(expected_counts):
    raise ValueError("Unexpected table manifest; use the generated synthetic schema.json")
existing = [name for name in expected_counts if spark.catalog.tableExists(name)]
if existing:
    raise ValueError(f"Refusing to overwrite existing tables: {existing}; use a dedicated empty demo lakehouse")

types = {
    "string": T.StringType,
    "integer": T.IntegerType,
    "double": T.DoubleType,
    "boolean": T.BooleanType,
}
frames = {}
for name, fields in schema_data.items():
    schema = T.StructType([T.StructField(field["name"], types[field["type"]](), True) for field in fields])
    frame = (
        spark.read.schema(schema)
        .option("header", True)
        .option("mode", "FAILFAST")
        .csv(f"Files/agent-ready-demo/csv/{name}.csv")
    )
    count = frame.count()
    if count != expected_counts[name]:
        raise ValueError(f"{name}: expected {expected_counts[name]} synthetic rows, got {count}")
    if frame.filter(reduce(lambda a, b: a | b, [F.col(c).isNull() for c in frame.columns])).limit(1).count():
        raise ValueError(f"{name}: null or unparseable fields")
    frames[name] = frame

for name, frame in frames.items():
    frame.write.format("delta").mode("errorifexists").saveAsTable(name)
    print(f"Created {name}: {expected_counts[name]} synthetic rows")
print("Synthetic bootstrap complete. No upstream integrations or security roles were provisioned.")

import test from "node:test";
import assert from "node:assert/strict";
import { parseFabricTime } from "../sync-d365.mjs";

test("Fabric timestamps without a timezone are UTC, not the worker's local time", () => {
  const expected = Date.UTC(2026, 10, 10, 17, 32, 3, 549);
  assert.equal(parseFabricTime("2026-11-10T17:32:03.5492319"), expected);
  assert.equal(parseFabricTime("2026-11-10T17:32:03.549Z"), expected);
  assert.equal(parseFabricTime("2026-11-10T19:32:03.549+02:00"), expected);
  const now = Date.UTC(2026, 10, 10, 17, 38);
  assert.ok(now - parseFabricTime("2026-11-10T17:32:03.5492319") > 5 * 60 * 1000);
  assert.ok(now - parseFabricTime("2026-11-10T17:37:03") < 5 * 60 * 1000);
});

test("missing and malformed job times fail explicitly", () => {
  assert.throws(() => parseFabricTime(undefined), /Missing Fabric job UTC timestamp/);
  assert.throws(() => parseFabricTime("not-a-date"), /Invalid Fabric job UTC timestamp/);
});

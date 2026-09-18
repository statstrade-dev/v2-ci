import test from "node:test";
import assert from "node:assert/strict";
import {validateDatabaseReleaseRequest} from "./validate-database-release.mjs";

const sourceSha = "0123456789abcdef0123456789abcdef01234567";

test("accepts testing reset and production incremental releases", () => {
  assert.deepEqual(
    validateDatabaseReleaseRequest({
      sourceSha,
      sourceRef: "release",
      target: "testing",
      mode: "reset",
    }),
    {sourceSha, sourceRef: "release", target: "testing", mode: "reset"},
  );
  assert.deepEqual(
    validateDatabaseReleaseRequest({
      sourceSha,
      sourceRef: "release",
      target: "production",
      mode: "incremental",
    }),
    {
      sourceSha,
      sourceRef: "release",
      target: "production",
      mode: "incremental",
    },
  );
});

test("rejects invalid source identity", () => {
  assert.throws(
    () =>
      validateDatabaseReleaseRequest({
        sourceSha: "0123456789abcdef",
        sourceRef: "release..candidate",
        target: "testing",
        mode: "reset",
      }),
    /source_sha.*source_ref/,
  );
});

test("rejects destructive production and non-destructive testing modes", () => {
  assert.throws(
    () =>
      validateDatabaseReleaseRequest({
        sourceSha,
        sourceRef: "release",
        target: "production",
        mode: "reset",
      }),
    /production deployments/,
  );
  assert.throws(
    () =>
      validateDatabaseReleaseRequest({
        sourceSha,
        sourceRef: "release",
        target: "testing",
        mode: "incremental",
      }),
    /testing deployments/,
  );
  assert.throws(
    () =>
      validateDatabaseReleaseRequest({
        sourceSha,
        sourceRef: "release/2026",
        target: "production",
        mode: "incremental",
      }),
    /release ref/,
  );
});

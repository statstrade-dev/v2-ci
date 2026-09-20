const shaPattern = /^[0-9a-f]{40}$/;
const refPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function validateDatabaseReleaseRequest({
  sourceSha,
  sourceRef,
  target,
  mode,
}) {
  const errors = [];
  if (!shaPattern.test(sourceSha ?? "")) {
    errors.push("source_sha must be a 40-character lowercase commit SHA.");
  }
  if (!refPattern.test(sourceRef ?? "") || sourceRef.includes("..")) {
    errors.push("source_ref must be a valid v2-db branch or ref.");
  }
  if (!["testing", "production"].includes(target)) {
    errors.push("target must be testing or production.");
  }
  if (!["reset", "incremental"].includes(mode)) {
    errors.push("mode must be reset or incremental.");
  }
  if (target === "production" && mode === "reset") {
    errors.push("production deployments are incremental-only.");
  }
  if (target === "production" && sourceRef !== "main") {
    errors.push("production deployments must use the main ref.");
  }
  if (target === "testing" && mode === "incremental") {
    errors.push("testing deployments require reset mode.");
  }
  if (errors.length) throw new Error(errors.join(" "));
  return {sourceSha, sourceRef, target, mode};
}

if (process.argv[1]?.endsWith("validate-database-release.mjs")) {
  try {
    validateDatabaseReleaseRequest({
      sourceSha: process.env.SOURCE_SHA,
      sourceRef: process.env.SOURCE_REF,
      target: process.env.TARGET,
      mode: process.env.MODE,
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

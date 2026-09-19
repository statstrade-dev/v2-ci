# Greenways CI

`statstrade-dev/v2-ci` runs central validation for exact revisions of
`statstrade-dev/v2-db`. The repository is being rebuilt from a minimal,
database-first gate.

## Initial V2 DB gate

The active `.github/workflows/v2-ci.yml` workflow accepts the
`v2-db-changed` dispatch from `statstrade-dev/v2-db`, checks out the exact
source commit, validates `foundation.lock`, installs the exact Foundation
commit recorded by that lock, and runs a three-entry matrix:

```sh
./lein test :with "[gwdb.common]"
./lein test :with "[gwdb.fn]"
./lein test :with "[gwdb.rpc]"
```

The matrix does not fail fast, so all three selectors produce independent
results and logs. Execution uses the pinned
`ghcr.io/zcaudate-xyz/infra-foundation-dev:ci` runtime, which supplies the
supported Java and Leiningen environment.

The source workflow lives in
`statstrade-dev/v2-db/.github/workflows/request-v2-ci.yml`. The source
repository must configure a repository-scoped `GH_TOKEN` secret with
permission to dispatch the central workflow. The central repository uses its
own repository-scoped `GH_TOKEN` to check out the private source and publish
the `v2-ci/gwdb` commit status.

## Version provenance

`v2-db/foundation.lock` is the source-side contract for the Foundation
repository, immutable ref, commit SHA, and Foundation project version. The
workflow rejects malformed locks, mismatched checkouts, and Foundation
version/SHA drift before any selector runs. Each run summary and test artifact
includes the backend-db version and Foundation version/SHA.

backend-db versioning is independent from Foundation and from Supabase
deployment. Its `project.clj` version is checked by `v<version>` release
preflight tags; backend-db is not deployed to Clojars by this workflow.

The test log is retained as a workflow artifact for 14 days. Additional
database, generated-artifact, service, frontend, documentation, and
deployment gates will be added as separate slices rather than hidden behind
this first test command.

## RPC contract publication

`.github/workflows/publish-rpc-contracts.yml` publishes the database-owned RPC
contracts for an exact `statstrade-dev/v2` commit. It accepts the existing
`v2-ci-requested` dispatch when the `gwdb_rpc` segment is selected, the
explicit `v2-rpc-contracts` dispatch, or a manual workflow dispatch with a
40-character `source_sha`.

The uploaded `rpc-contracts-<source_sha>` artifact contains:

- `rpc-api.json`, copied from the database OpenAPI publication;
- `rpc-view.json`, copied from the database view publication or derived from
  the API's `x-gwlink.views` extension when that is the source format;
- `provenance.json`, containing the exact V2 and backend-db revisions and
  SHA-256 digests.

The workflow checks out the requested V2 commit and its pinned `backend-db`
gitlink before reading either publication. It does not write back to V2 or
publish credentials.

## License

Private and proprietary to Greenways AI.

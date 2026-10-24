# Greenways CI

`statstrade-dev/v2-ci` runs central validation for exact revisions of
`statstrade-dev/v2-db` and the frontend/documentation gates for
`statstrade-dev/v2`. Database and source requests have separate receivers.

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

## Protected v2-db database release

`.github/workflows/v2-db-database-release.yml` accepts an explicit
`statstrade-dev/v2-db` source ref and commit. It checks out that exact commit,
verifies that the named ref still points to it, validates the source
Foundation lock, and records migration and source provenance in a run
artifact.

Production requests are restricted to `main` and `incremental` mode. The
protected `statstrade-database-production` environment supplies the
allowlisted database configuration, and the workflow applies only
`docker/gw-db/supabase/migrations` with `supabase db push`; it never applies a
full SQL snapshot to production. Testing remains a separate protected reset
path.

## Database publication exports

`.github/workflows/publish-rpc-contracts.yml` continues to publish the
database-owned contracts for exact `statstrade-dev/v2` source revisions
requested by the existing V2 contract events.

`.github/workflows/publish-db-rpc-contracts.yml` publishes the backend-db
exports for an exact `statstrade-dev/v2-db` release commit. The central DB
gate requests this publication only after all DB selectors pass and only when
the source ref is `release`. The publisher independently verifies that the
exact SHA is the current `release` ref before checking it out, then creates or
updates the matching GitHub Release.

The uploaded `rpc-contracts-backend-db-<version>-<source_sha>` artifact contains
only:

- `gwdb-full.sql` and `gwdb-full-<version>.sql`;
- `gwdb-full.edn` and `gwdb-full-<version>.edn`;
- `provenance.json`, containing the exact backend-db release SHA, version, and
  SHA-256 digests for both exports.

The source-side `backend-db` Makefile invokes
`gwbuild.db.gen-rpc-exports` directly. `make rpc-api-publish` stages the two
database exports locally, while `make rpc-api-dispatch` requests the protected
central DB gate; `make rpc-api-release` performs the same release checks locally.
The central publisher uses the `GH_TOKEN` secret with write access to
`statstrade-dev/v2-db` contents and read access to its commit statuses.
Neither path publishes credentials or adds a provider/package release path.

## License

Private and proprietary to Greenways AI.

## V2 source frontend and documentation gates

`.github/workflows/v2-source-ci.yml` receives the existing `v2-ci-requested`
event (source schema 3). It validates the repository, exact 40-character SHA,
and boolean segment map before checking out that revision. It leaves the
`v2-db-changed` database pipeline unchanged.

Requested `frontend` and `docs` segments run the historical Storybook and
Docusaurus/Build Portal validation commands, including business-plan PDFs and
Netlify's **offline build** packaging checks. This restores validation only:
there is no preview/production deployment, release, or publication path.
The source checkout does not persist the checkout token, and source builds
run separately from the trusted status reporter.

An always-running reporter maps actual job results back to `v2-ci/frontend`
and `v2-ci/docs` on the exact requested SHA. Failed setup/build/upload, skipped
requested jobs, and cancellation cannot be reported as success. Unrequested
segments are not touched. A requested legacy backend/language segment without
a runner receives an explicit error, not a fabricated pass or indefinite
pending status; its runner must be restored separately before enabling it.
The existing source-side backend-disable policy is not changed here.

Same-SHA requests are serialized without cancelling an active status reporter.
GitHub still permits manual cancellation and infrastructure/API failures, so
status delivery cannot be guaranteed if GitHub cannot start or finish the
reporter; inspect the linked central run in that case.

Local contract validation (also run on central pull requests):

```sh
node --test .github/scripts/*.test.mjs
```

These tests exercise selection, strict payload validation, source identity,
terminal status mapping, unsupported gates, and status API failures. They do
not certify frontend/docs builds. Repository dispatch only loads workflows
from the default branch, so after review and merge, rerun the source request
for the **same source SHA** and verify both real build results and their linked
source statuses. A draft central PR cannot activate this receiver.

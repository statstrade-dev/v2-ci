# Greenways CI

`statstrade-dev/v2-ci` runs central validation for exact revisions of
`statstrade-dev/v2`. The source repository sends one correlated
`v2-ci-requested` event with schema version 3 and the affected slices.

## V2 slices

The active `.github/workflows/v2-ci.yml` orchestrator exposes independently
rerunnable jobs and source commit statuses for:

```text
gwdb.core
gwdb.rpc
gwbuild and generated-artifact reproducibility
gwlink
backend support namespaces
gwlink JavaScript build
gwlink Dart build
main Yarn/Turbo frontend
Docusaurus
```

Backend jobs use `_v2-backend-segment.yml`; generated-language builds use
`_v2-language-build.yml`; frontend and documentation have dedicated reusable
runners. Every runner checks out the notified V2 SHA. Backend and language
jobs additionally resolve and install the Foundation revision pinned by that
SHA.

Pull requests and `develop` pushes are selected by the V2 source detector.
Every `main` push and manual full run requests all slices. Unaffected source
contexts are marked successful without starting central jobs.

## Statstrade environments

`statstrade-environment.yml` owns the trusted lifecycle orchestration for
`NAME.dev.statstrade.io` and `NAME.supabase.statstrade.io`. The V2 control
plane dispatches it with a source repository and ref; the workflow resolves the
ref to an immutable commit before building.

Provider credentials are loaded from an explicit revision of
`statstrade-dev/dot-secrets` with the repository-scoped `GH_TOKEN`. The strict
loader exposes allowlisted values only to the trusted steps that need them.
Arbitrary source builds receive the public environment URL and anon key but no
Netlify, Cloudflare, SSH, or secrets-repo credentials.

Successful exact-`main` Storybook and documentation checks build the frontend once, without requiring a backend build, and deploy
the immutable frontend artifact to `next.statstrade.io`. Protected promotion
reuses that artifact for `www.statstrade.io` and advances `prod` only after the
production deploy passes smoke tests. Until an approved promotion, the exact
`www-statstrade-io` Netlify project continues to serve the temporary branded
construction site; production promotion verifies that project name, account,
and configured site ID before replacing its content.

Full exact-`main` V2 CI runs also deploy the protected
`testing.dev.statstrade.io` environment and publish a non-secret release
manifest. Initial testing creation is gated on the validated
`main/sql/deploy/bootstrap.sql` artifact required by plan 2110.

## Generated artifacts

The `gwbuild` slice runs the canonical RPC, link and SQL generators and fails
if tracked generated output differs. This protects the sequence:

```text
source definition -> generator -> tracked artifact -> consumer build
```

## v2-db database releases

`v2-db-database-release.yml` is the central execution path for manually
requested database releases. The workflow requires an exact
`statstrade-dev/v2-db` commit and a source branch or ref; it verifies that the
requested ref still points at that commit before building or deploying. The
Foundation revision is also an explicit workflow input and is recorded in the
deployment manifest.

Testing requests use the separate
`statstrade/v2-db/testing/supabase.env` dot-secrets profile and are limited
to a destructive migration reset. That profile requires
`SUPABASE_DB_URL` and `SUPABASE_DB_PASS`; the password is passed only through
the process environment. Production requests use `statstrade/prod`, are
incremental-only, and require the protected
`statstrade-database-production` environment. The workflow checks out a
detached dot-secrets revision, exposes only the target-specific database
allowlist, and retains a non-secret provenance manifest. Production requires
`SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `DATABASE_URL`, and `POSTGRES_DB`
across its `.env` files. A missing testing profile is a deliberate preflight
failure; production configuration is never used as a fallback.

Focused local checks for the workflow helpers are:

```sh
node --test .github/scripts/load-env-files.test.mjs
node --test .github/scripts/validate-database-release.test.mjs
```

## Diagnostics

Each selected job retains its focused logs or build output for 14 days and
links the final source status to the correlated central run.

## License

Private and proprietary to Greenways AI.

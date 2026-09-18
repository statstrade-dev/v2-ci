# Greenways CI

`statstrade-dev/v2-ci` runs central validation for exact revisions of
`statstrade-dev/v2-db`. The repository is being rebuilt from a minimal,
database-first gate.

## Initial V2 DB gate

The active `.github/workflows/v2-ci.yml` workflow accepts the
`v2-db-changed` dispatch from `statstrade-dev/v2-db`, checks out the exact
source commit, installs the pinned Foundation checkout, and runs:

```sh
./lein test :with "[gwdb.common gwdb.fn gwdb.rpc]"
```

Execution uses the pinned `ghcr.io/zcaudate-xyz/infra-foundation-dev:ci`
runtime, which supplies the supported Java and Leiningen environment.

The source workflow lives in
`statstrade-dev/v2-db/.github/workflows/request-v2-ci.yml`. The source
repository must configure a repository-scoped `GH_TOKEN` secret with
permission to dispatch the central workflow. The central repository uses its
own repository-scoped `GH_TOKEN` to check out the private source and publish
the `v2-ci/gwdb` commit status.

The test log is retained as a workflow artifact for 14 days. Additional
database, generated-artifact, service, frontend, documentation, and
deployment gates will be added as separate slices rather than hidden behind
this first test command.

## License

Private and proprietary to Greenways AI.

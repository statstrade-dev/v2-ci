import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contexts, validateRequest, reportRequest} from './v2-source-request.mjs';
const payload = () => ({source_repository: 'statstrade-dev/v2', source_sha: 'a'.repeat(40),
  metadata: {schema_version: 3}, segments: Object.fromEntries(Object.keys(contexts).map(k => [k, ['frontend', 'docs'].includes(k)]))});
const needs = (frontend = 'success', docs = 'success', request = 'success') => ({
  request: {result: request}, frontend: {result: frontend}, docs: {result: docs}});
const report = async (p, n, fail = false) => {
  const calls = [];
  const github = {rest: {repos: {createCommitStatus: async value => {calls.push(value); if (fail) throw new Error('API failed');}}}};
  let error;
  try { await reportRequest({github, payload: p, needs: n, runUrl: 'https://github.com/statstrade-dev/v2-ci/actions/runs/1'}); }
  catch (e) { error = e; }
  return {calls, error};
};
test('accepts current source schema and selects only requested build gates', () => {
  assert.deepEqual(validateRequest(payload()), {frontend: true, docs: true});
  const p = payload(); p.segments.docs = false;
  assert.deepEqual(validateRequest(p), {frontend: true, docs: false});
});
test('rejects wrong repository, mutable/missing SHA, schema drift and nonboolean/unknown/missing segments', () => {
  for (const edit of [p => p.source_repository = 'other/repo', p => p.source_sha = 'main',
    p => delete p.source_sha, p => p.metadata.schema_version = 2,
    p => p.segments.docs = 'true', p => delete p.segments.docs,
    p => p.segments.new_gate = true, p => p.segments.constructor = true,
    p => p.segments = null, p => p.segments = []]) {
    const p = payload(); edit(p); assert.throws(() => validateRequest(p));
  }
});
test('success reports exact source SHA and existing contexts, not unrequested gates', async () => {
  const {calls, error} = await report(payload(), needs()); assert.equal(error, undefined);
  assert.deepEqual(calls.map(c => c.context), ['v2-ci/frontend', 'v2-ci/docs']);
  assert.ok(calls.every(c => c.sha === 'a'.repeat(40) && c.state === 'success' && c.owner === 'statstrade-dev' && c.repo === 'v2'));
});
test('failed, skipped, cancelled and missing jobs never certify requested tests', async () => {
  for (const result of ['failure', 'skipped', 'cancelled']) {
    const {calls} = await report(payload(), needs(result, result));
    assert.ok(calls.every(c => c.state !== 'success'));
  }
  assert.ok((await report(payload(), {})).calls.every(c => c.state === 'failure'));
  assert.ok((await report(payload(), needs('success', 'success', 'failure'))).calls.every(c => c.state === 'failure'));
});
test('unsupported requested gates fail explicitly instead of remaining pending or becoming green', async () => {
  const p = payload(); p.segments.gwdb_core = true;
  const {calls, error} = await report(p, needs()); assert.match(error.message, /Unsupported/);
  assert.equal(calls.find(c => c.context === 'v2-ci/gwdb-core').state, 'error');
  assert.equal(calls.find(c => c.context === 'v2-ci/frontend').state, 'success');
});
test('invalid targets produce no status writes', async () => {
  const p = payload(); p.source_repository = 'attacker/repo';
  const {calls, error} = await report(p, needs()); assert.equal(calls.length, 0); assert.ok(error);
});
test('API failure still attempts every requested final status and fails the reporter', async () => {
  const {calls, error} = await report(payload(), needs(), true);
  assert.equal(calls.length, 2); assert.ok(error instanceof AggregateError);
});
test('unrequested segments are never reported as tested', async () => {
  const p = payload(); for (const key in p.segments) p.segments[key] = false;
  assert.equal((await report(p, needs())).calls.length, 0);
});
test('receiver listens to source event, preserves DB receiver, finalizes all outcomes and has no deploy path', () => {
  const wf = readFileSync(new URL('../workflows/v2-source-ci.yml', import.meta.url), 'utf8');
  assert.match(wf, /types: \[v2-ci-requested\]/);
  assert.match(wf, /needs: \[request, frontend, docs\]\n    if: always\(\)/);
  assert.match(wf, /cancel-in-progress: false/);
  assert.match(readFileSync(new URL('../workflows/v2-ci.yml', import.meta.url), 'utf8'), /types: \[v2-db-changed\]/);
  for (const kind of ['frontend', 'docs']) {
    const build = readFileSync(new URL(`../workflows/_v2-${kind}.yml`, import.meta.url), 'utf8');
    assert.match(build, /ref: \$\{\{ inputs.source_ref \}\}/);
    assert.match(build, /persist-credentials: false/);
    assert.doesNotMatch(build, /continue-on-error|NETLIFY_AUTH_TOKEN|netlify-cli.* deploy|^  deploy:/m);
  }
});

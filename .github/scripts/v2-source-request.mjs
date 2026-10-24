// The source owns selection; this receiver never reports an unrun gate as passed.
export const contexts = Object.freeze({
  gwdb_core: 'v2-ci/gwdb-core', gwdb_rpc: 'v2-ci/gwdb-rpc',
  gwbuild: 'v2-ci/gwbuild', gwlink: 'v2-ci/gwlink',
  backend_support: 'v2-ci/backend-support', gwlink_js: 'v2-ci/gwlink-js',
  gwlink_dart: 'v2-ci/gwlink-dart', frontend: 'v2-ci/frontend', docs: 'v2-ci/docs',
});
export function validateTarget(payload) {
  if (payload?.source_repository !== 'statstrade-dev/v2') throw new Error('Unexpected source repository');
  if (!/^[0-9a-f]{40}$/.test(payload.source_sha ?? '')) throw new Error('Expected exact source SHA');
}
export function validateRequest(payload) {
  validateTarget(payload);
  if (payload.metadata?.schema_version !== 3) throw new Error('Expected source request schema 3');
  if (!payload.segments || typeof payload.segments !== 'object' || Array.isArray(payload.segments)) {
    throw new Error('Expected segments object');
  }
  for (const key of Object.keys(payload.segments)) {
    if (!Object.hasOwn(contexts, key)) throw new Error(`Unknown segment: ${key}`);
  }
  for (const key of Object.keys(contexts)) {
    if (typeof payload.segments[key] !== 'boolean') throw new Error(`Expected boolean segment: ${key}`);
  }
  return {frontend: payload.segments.frontend, docs: payload.segments.docs};
}
export async function reportRequest({github, payload, needs, runUrl}) {
  // Never write statuses to a repository or ref supplied by an invalid target.
  validateTarget(payload);
  const errors = [];
  for (const [segment, context] of Object.entries(contexts)) {
    if (payload.segments?.[segment] !== true) continue;
    const supported = segment === 'frontend' || segment === 'docs';
    const result = needs[segment]?.result;
    const passed = needs.request?.result === 'success' && supported && result === 'success';
    const state = passed ? 'success' : (!supported || result === 'cancelled' ? 'error' : 'failure');
    const description = !supported ? 'Requested gate has no central runner; not tested'
      : passed ? `${segment} validation passed` : `${segment} validation did not pass (${result ?? 'not run'})`;
    try {
      await github.rest.repos.createCommitStatus({owner: 'statstrade-dev', repo: 'v2',
        sha: payload.source_sha, context, state, description, target_url: runUrl});
    } catch (error) { errors.push(error); }
  }
  if (errors.length) throw new AggregateError(errors, 'Could not report all source statuses');
  if (Object.keys(contexts).some(key => payload.segments?.[key] === true && !['frontend', 'docs'].includes(key))) {
    throw new Error('Unsupported requested segments were reported as errors; no tests were run for them');
  }
}

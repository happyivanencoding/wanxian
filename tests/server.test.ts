import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createDirectorMiddleware, decideWithStartLux, DIRECTOR_ENDPOINT, DIRECTOR_MODEL, parseDirectorRequest, readDirectorAnswer, readDirectorKey } from '../server/director.ts';
import { createDirectorClient } from '../src/lib/directorClient.ts';
import type { DirectorRequest } from '../src/game/types.ts';

const request: DirectorRequest = {
  kind: 'npc', age: 27, actorId: 'peer-1',
  context: { location: '云泽', relationship: 70, health: 45 },
  candidates: [
    { id: 'reserved', label: '相待', description: '留有分寸地相待' },
    { id: 'medicine', label: '辨药', description: '已经相识的药师帮助辨药' },
  ],
};
const providerAnswer = (extra: Record<string, unknown> = {}) => ({ answers: { scene: { type: 'choice', choice: 'medicine', confidence: 0.85, none_probability: 0.01, ...extra } } });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const decision = { kind: 'npc', age: 27, actorId: 'peer-1', candidateId: 'medicine', source: 'startlux' } as const;

test('director validates bounded candidates and preserves only the public request contract', () => {
  assert.deepEqual(parseDirectorRequest({ ...request, arbitrary: 'ignored' }), request);
  assert.equal(parseDirectorRequest({ ...request, candidates: request.candidates.slice(0, 1) }), undefined);
  assert.equal(parseDirectorRequest({ ...request, candidates: [...request.candidates, request.candidates[0]] }), undefined);
  assert.equal(parseDirectorRequest({ ...request, context: { text: 'x'.repeat(23000) } }), undefined);
  assert.equal(parseDirectorRequest({ ...request, candidates: [{ ...request.candidates[0], id: '../escape' }, request.candidates[1]] }), undefined);
  assert.equal(parseDirectorRequest({ ...request, age: -1 }), undefined);
  assert.equal(readDirectorKey({}, process.cwd()), undefined);
  assert.equal(readDirectorKey({ STARTLUX_KEY_FILE: 'does-not-exist' }, process.cwd()), undefined);
});

test('null, invented, uncertain and malformed model replies never become engine decisions', () => {
  assert.deepEqual(readDirectorAnswer(providerAnswer(), request), { source: 'startlux', decision });
  assert.equal(readDirectorAnswer(providerAnswer({ confidence: 0.3 }), request).source, 'startlux', 'Several legal reactions may be similarly plausible; confidence is not a correctness threshold.');
  for (const override of [{ choice: null }, { choice: 'free-reward' }, { confidence: -0.1 }, { confidence: 1.1 }, { none_probability: 0.2 }, { none_probability: -0.1 }, { none_probability: undefined }, { type: 'boolean' }]) {
    assert.equal(readDirectorAnswer(providerAnswer(override), request).source, 'local');
  }
  assert.equal(readDirectorAnswer({ error: 'provider details' }, request).source, 'local');
});

test('provider uses the fixed model, contextual candidates and server-only authorization', async () => {
  let calls = 0;
  const result = await decideWithStartLux(request, { apiKey: 'test-secret-only', fetch: async (url, init) => {
    calls++;
    assert.equal(url, DIRECTOR_ENDPOINT);
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-secret-only');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, DIRECTOR_MODEL);
    assert.deepEqual(body.state.facts, request.context);
    assert.deepEqual(Object.keys(body.questions.scene.criteria), ['reserved', 'medicine']);
    assert.equal(body.allow_none, true);
    assert.equal(body.think_mode, 'never', 'Interactive ranking must not invoke the slow optional thinking pass.');
    return response(providerAnswer());
  } });
  assert.equal(calls, 1);
  assert.deepEqual(result, { source: 'startlux', decision });
  assert.equal(JSON.stringify(result).includes('test-secret-only'), false);
});

test('missing key, unavailable upstream and timeout all preserve a local result', async () => {
  let calls = 0;
  const neverCalled: typeof fetch = async () => { calls++; throw new Error('not configured'); };
  assert.deepEqual(await decideWithStartLux(request, { fetch: neverCalled }), { source: 'local', reason: 'unavailable' });
  assert.equal(calls, 0);
  assert.deepEqual(await decideWithStartLux(request, { apiKey: 'test', fetch: async () => response({ secret: 'must-not-leak' }, 503) }), { source: 'local', reason: 'unavailable' });
  const timeoutFetch: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  assert.deepEqual(await decideWithStartLux(request, { apiKey: 'test', fetch: timeoutFetch, deadlineMs: 15 }), { source: 'local', reason: 'timeout' });
});

test('same-port middleware serves status but rejects cross-origin and invalid requests without provider calls', async () => {
  let calls = 0;
  const handler = createDirectorMiddleware({ apiKey: 'test-secret-only', fetch: async () => { calls++; return response(providerAnswer()); } });
  const server = createServer((req, res) => { void handler(req, res, () => { res.writeHead(404); res.end(); }); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const status = await (await fetch(`${base}/api/director/status`)).json();
    assert.deepEqual(status, { configured: true, provider: 'StartLux', model: DIRECTOR_MODEL });
    assert.equal(JSON.stringify(status).includes('test-secret-only'), false);
    for (const origin of ['', 'http://other-site.invalid']) {
      const denied = await fetch(`${base}/api/director/decide`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      assert.equal(denied.status, 403);
    }
    const invalid = await fetch(`${base}/api/director/decide`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(invalid.status, 400);
    assert.equal(calls, 0);
    const accepted = await fetch(`${base}/api/director/decide`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify(request) });
    assert.deepEqual(await accepted.json(), { source: 'startlux', decision });
    assert.equal(calls, 1);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('client works offline without requests, and rejects stale or unknown replies', async () => {
  let calls = 0;
  const offline = createDirectorClient(async () => { calls++; throw new Error('offline'); }, () => false);
  assert.equal((await offline.decide(request, new AbortController().signal)).source, 'local');
  assert.equal(calls, 0);
  for (const changed of [{ age: 28 }, { actorId: 'peer-0' }, { candidateId: 'invented' }]) {
    const client = createDirectorClient(async url => String(url).endsWith('/status') ? response({ configured: true }) : response({ source: 'startlux', decision: { ...decision, ...changed } }));
    assert.equal((await client.decide(request, new AbortController().signal)).source, 'local');
  }
});

test('client caches status and backs off failures while allowing later recovery', async () => {
  let now = 100, calls = 0, fail = true;
  const client = createDirectorClient(async url => {
    calls++;
    if (String(url).endsWith('/status')) return response({ configured: true });
    return response(fail ? { source: 'local', reason: 'unavailable' } : { source: 'startlux', decision });
  }, () => true, () => now);
  assert.equal((await client.decide(request, new AbortController().signal)).source, 'local');
  assert.equal(calls, 2);
  await client.decide(request, new AbortController().signal);
  assert.equal(calls, 2);
  now += 16000; fail = false;
  assert.deepEqual(await client.decide(request, new AbortController().signal), { source: 'startlux', decision });
  assert.equal(calls, 3);
});

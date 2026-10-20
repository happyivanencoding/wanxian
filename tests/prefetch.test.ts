import test from 'node:test';
import assert from 'node:assert/strict';
import { act, commitDirectedAction, createGame, planDirectedAction } from '../src/game/engine.ts';
import { createDirectorPrefetch } from '../src/lib/directorPrefetch.ts';
import type { DirectorReply } from '../src/lib/directorClient.ts';
import type { DirectorDecision, DirectorRequest, Game } from '../src/game/types.ts';

const request: DirectorRequest = {
  kind: 'npc', age: 40, actorId: 'peer-1', context: { relation: 70 },
  candidates: [{ id: 'reserved', label: '相待', description: '留有分寸' }, { id: 'medicine', label: '辨药', description: '以医理相助' }],
};
function answer(value: DirectorRequest, candidateId = value.candidates[1].id): DirectorDecision {
  return { kind: value.kind, age: value.age, ...(value.actorId ? { actorId: value.actorId } : {}), candidateId, source: 'startlux' };
}
function controlledClient() {
  const calls: { request: DirectorRequest; signal: AbortSignal; resolve: (reply: DirectorReply) => void; reject: (error: Error) => void }[] = [];
  return {
    calls,
    decide(request: DirectorRequest, signal: AbortSignal): Promise<DirectorReply> {
      // Deliberately ignore abort here: a reply can already be in flight when cancelled.
      return new Promise((resolve, reject) => calls.push({ request, signal, resolve, reject }));
    },
  };
}
async function flushReplies() { await Promise.resolve(); await Promise.resolve(); }
function nextYearFixture(): Game {
  const g = createGame({ name: '预取边界', gender: '随缘', origin: 'merchant', era: 'peace', route: 'balanced', region: 'qinglan', mode: 'seeker', fastStart: true, seed: 'prefetch-browser' });
  g.age = 40; g.realm = 2; g.progress = 50; g.lifespan = 260; g.stones = 160; g.focus = 'adventure'; g.pending = null;
  g.seen['story-call-guardian'] = 20;
  g.stats = { health: 70, mind: 60, insight: 55, foundation: 55, alchemy: 30, combat: 40, reputation: 35 };
  for (const npc of g.npcs) { npc.age = 40; npc.realm = 2; npc.lifespan = 260; npc.relation = 65; npc.progress = 0; }
  g.rng = 65537;
  return g;
}

test('previewing next year never advances life; a pending prefetch immediately yields the seeded local year', async () => {
  const g = nextYearFixture(), before = structuredClone(g), action = { type: 'advance' } as const;
  const plan = planDirectedAction(g, action); assert.ok(plan.request);
  assert.equal(plan.request.kind, 'event'); assert.equal(plan.result.game.pending, 'auction');
  assert.deepEqual(g, before);
  const client = controlledClient(), prefetch = createDirectorPrefetch(client);
  prefetch.prepare(g, 'advance', plan.request);
  assert.equal(client.calls.length, 1);
  assert.deepEqual(g, before);
  const ready = prefetch.take(g, 'advance');
  assert.equal(ready, undefined, 'The clock boundary must not return a promise or wait for the request.');
  assert.equal(client.calls[0].signal.aborted, true);
  const atBoundary = ready ? commitDirectedAction(g, action, ready) : plan.result;
  assert.deepEqual(atBoundary, act(g, action));
  assert.equal(atBoundary.game.age, g.age + 1);
  const settled = structuredClone(atBoundary.game);
  client.calls[0].resolve({ source: 'startlux', decision: answer(plan.request, 'cave') });
  await flushReplies();
  assert.equal(prefetch.take(g, 'advance'), undefined);
  assert.deepEqual(atBoundary.game, settled, 'A late online reply cannot rewrite the year that already happened.');
});

test('an early ready choice is consumed synchronously once and still requires an explicit engine commit', async () => {
  const g = nextYearFixture(), action = { type: 'advance' } as const, before = structuredClone(g);
  const plan = planDirectedAction(g, action); assert.ok(plan.request);
  const client = controlledClient(), prefetch = createDirectorPrefetch(client);
  prefetch.prepare(g, 'advance', plan.request);
  const selected = answer(plan.request, 'cave');
  client.calls[0].resolve({ source: 'startlux', decision: selected }); await flushReplies();
  assert.deepEqual(g, before);
  const ready = prefetch.take(g, 'advance'); assert.deepEqual(ready, selected);
  assert.equal(prefetch.take(g, 'advance'), undefined);
  const result = commitDirectedAction(g, action, ready).game;
  assert.equal(result.age, g.age + 1); assert.equal(result.pending, 'cave');
  assert.equal(result.choices, g.choices, 'The selected encounter still waits for the player response.');
  assert.equal(result.directorRecords?.at(-1)?.source, 'startlux');
});

test('repeated renders of one state and action do not multiply pending or ready API requests', async () => {
  const client = controlledClient(), prefetch = createDirectorPrefetch(client), g = { id: 'life', age: 40 };
  prefetch.prepare(g, 'npc:peer-1:talk', request);
  prefetch.prepare(g, 'npc:peer-1:talk', request);
  assert.equal(client.calls.length, 1);
  client.calls[0].resolve({ source: 'startlux', decision: answer(request) }); await flushReplies();
  prefetch.prepare(g, 'npc:peer-1:talk', request);
  assert.equal(client.calls.length, 1);
  assert.deepEqual(prefetch.take(g, 'npc:peer-1:talk'), answer(request));
  assert.equal(prefetch.take(g, 'npc:peer-1:talk'), undefined);
});

test('the exact state object and action must match, including a reloaded save with identical life id', async () => {
  for (const mismatch of ['state', 'action'] as const) {
    const client = controlledClient(), prefetch = createDirectorPrefetch(client), g = { id: 'same-life', age: 40 };
    prefetch.prepare(g, 'npc:peer-1:talk', request);
    client.calls[0].resolve({ source: 'startlux', decision: answer(request) }); await flushReplies();
    assert.equal(prefetch.take(mismatch === 'state' ? { ...g } : g, mismatch === 'action' ? 'npc:peer-1:gift' : 'npc:peer-1:talk'), undefined);
    assert.equal(prefetch.take(g, 'npc:peer-1:talk'), undefined, 'A rejected result cannot be reused after another action.');
  }
});

test('preparing a different action cancels the previous request and rejects its late reply', async () => {
  const client = controlledClient(), prefetch = createDirectorPrefetch(client), g = { id: 'life' };
  prefetch.prepare(g, 'npc:peer-1:talk', request);
  prefetch.prepare(g, 'npc:peer-1:gift', request);
  assert.equal(client.calls.length, 2); assert.equal(client.calls[0].signal.aborted, true);
  client.calls[0].resolve({ source: 'startlux', decision: answer(request, 'reserved') }); await flushReplies();
  client.calls[1].resolve({ source: 'startlux', decision: answer(request, 'medicine') }); await flushReplies();
  assert.deepEqual(prefetch.take(g, 'npc:peer-1:gift'), answer(request, 'medicine'));
});

test('disabling the director or starting another life cancels old ready and in-flight results', async () => {
  const client = controlledClient(), prefetch = createDirectorPrefetch(client), oldLife = { id: 'old' }, nextLife = { id: 'new' };
  prefetch.prepare(oldLife, 'talk', request);
  prefetch.cancel();
  assert.equal(client.calls[0].signal.aborted, true);
  client.calls[0].resolve({ source: 'startlux', decision: answer(request) }); await flushReplies();
  assert.equal(prefetch.take(oldLife, 'talk'), undefined);
  prefetch.prepare(oldLife, 'talk', request);
  client.calls[1].resolve({ source: 'startlux', decision: answer(request) }); await flushReplies();
  prefetch.cancel();
  assert.equal(prefetch.take(oldLife, 'talk'), undefined, 'Disabling also clears a result already ready.');
  prefetch.prepare(oldLife, 'talk', request);
  prefetch.prepare(nextLife, 'talk', request);
  assert.equal(client.calls[2].signal.aborted, true);
  client.calls[2].resolve({ source: 'startlux', decision: answer(request, 'reserved') }); await flushReplies();
  assert.equal(prefetch.take(nextLife, 'talk'), undefined, 'An old-life reply cannot satisfy a new-life pending request.');
  client.calls[3].resolve({ source: 'startlux', decision: answer(request) }); await flushReplies();
  assert.equal(prefetch.take(nextLife, 'talk'), undefined, 'Once the local action was consumed, even its own reply is too late.');
});

test('offline results and rejected background requests stay quiet and immediately usable locally', async () => {
  for (const outcome of ['local', 'reject'] as const) {
    const client = controlledClient(), prefetch = createDirectorPrefetch(client), g = { id: 'offline' };
    prefetch.prepare(g, 'talk', request);
    if (outcome === 'local') client.calls[0].resolve({ source: 'local', reason: 'unavailable' });
    else client.calls[0].reject(new Error('network unavailable'));
    await flushReplies();
    prefetch.prepare(g, 'talk', request);
    assert.equal(client.calls.length, 1, 'Renders should not retry the same failed prefetch.');
    assert.equal(prefetch.take(g, 'talk'), undefined);
  }
});

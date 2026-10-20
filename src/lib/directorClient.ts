import type { DirectorDecision, DirectorRequest } from '../game/types.ts';

export type DirectorStatus = { configured: boolean; reachable: boolean };
export type DirectorReply = { source: 'startlux'; decision: DirectorDecision } | { source: 'local'; reason: string };
type Fetcher = typeof fetch;

async function requestJSON(fetcher: Fetcher, url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new Error('cancelled');
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('unavailable');
    return await response.json();
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }

/** Only contacts this game's same-origin helper; a static/offline build stays fully playable. */
export function createDirectorClient(fetcher: Fetcher = fetch, online = () => typeof navigator === 'undefined' || navigator.onLine, now = Date.now) {
  let status: DirectorStatus | undefined;
  let checkAfter = 0;
  let retryAfter = 0;
  async function getStatus(force = false): Promise<DirectorStatus> {
    if (!online()) return { configured: false, reachable: false };
    if (!force && status && now() < checkAfter) return status;
    try {
      const data = await requestJSON(fetcher, '/api/director/status', { method: 'GET' }, 900);
      status = record(data) && typeof data.configured === 'boolean' ? { configured: data.configured, reachable: true } : { configured: false, reachable: false };
    } catch { status = { configured: false, reachable: false }; }
    checkAfter = now() + 30000;
    if (force) retryAfter = 0;
    return status;
  }
  async function decide(request: DirectorRequest, signal: AbortSignal): Promise<DirectorReply> {
    if (signal.aborted || !online() || now() < retryAfter) return { source: 'local', reason: 'unavailable' };
    const available = await getStatus();
    if (!available.configured || signal.aborted) return { source: 'local', reason: 'unavailable' };
    try {
      const data = await requestJSON(fetcher, '/api/director/decide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) }, 3400, signal);
      if (signal.aborted) return { source: 'local', reason: 'unavailable' };
      if (record(data) && data.source === 'startlux' && record(data.decision)) {
        const decision = data.decision;
        if (decision.source === 'startlux' && decision.kind === request.kind && decision.age === request.age && decision.actorId === request.actorId && request.candidates.some(item => item.id === decision.candidateId)) {
          return { source: 'startlux', decision: decision as unknown as DirectorDecision };
        }
      }
      const reason = record(data) && typeof data.reason === 'string' ? data.reason : 'invalid';
      if (['unavailable', 'timeout', 'busy'].includes(reason)) retryAfter = now() + (reason === 'busy' ? 3000 : 15000);
      return { source: 'local', reason };
    } catch {
      if (!signal.aborted) { retryAfter = now() + 15000; status = { configured: true, reachable: false }; checkAfter = retryAfter; }
      return { source: 'local', reason: 'unavailable' };
    }
  }
  return { getStatus, decide };
}

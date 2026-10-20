import type { DirectorDecision, DirectorRequest } from '../game/types.ts';
import type { DirectorReply } from './directorClient.ts';

type Client = { decide: (request: DirectorRequest, signal: AbortSignal) => Promise<DirectorReply> };
type Prepared = { game: object; actionKey: string; controller: AbortController; decision?: DirectorDecision };

/** One next action only. Reading at its deadline is synchronous and never waits. */
export function createDirectorPrefetch(client: Client) {
  let current: Prepared | undefined;
  function cancel() {
    const previous = current;
    current = undefined;
    previous?.controller.abort();
  }
  function prepare(game: object, actionKey: string, request: DirectorRequest): void {
    if (current?.game === game && current.actionKey === actionKey) return;
    cancel();
    const ticket: Prepared = { game, actionKey, controller: new AbortController() };
    current = ticket;
    void client.decide(request, ticket.controller.signal).then(reply => {
      if (current === ticket && !ticket.controller.signal.aborted && reply.source === 'startlux') ticket.decision = reply.decision;
    }).catch(() => { /* The local plan is already available; failed preparation changes nothing. */ });
  }
  function take(game: object, actionKey: string): DirectorDecision | undefined {
    const decision = current?.game === game && current.actionKey === actionKey ? current.decision : undefined;
    cancel();
    return decision;
  }
  return { prepare, take, cancel };
}

import { useSyncExternalStore } from "react";
import type { MessageRow } from "./hooks";

export type OptimisticMessage = MessageRow & {
  _optimistic: true;
  _externalId?: string | null;
};

type Listener = () => void;

const map = new Map<string, OptimisticMessage[]>();
const listeners = new Set<Listener>();
const EMPTY: OptimisticMessage[] = [];

function emit() {
  listeners.forEach((l) => l());
}

export const optimisticStore = {
  get(conversationId: string): OptimisticMessage[] {
    return map.get(conversationId) ?? EMPTY;
  },
  add(conversationId: string, msg: OptimisticMessage) {
    const arr = map.get(conversationId) ?? [];
    map.set(conversationId, [...arr, msg]);
    emit();
  },
  update(conversationId: string, id: string, patch: Partial<OptimisticMessage>) {
    const arr = map.get(conversationId);
    if (!arr) return;
    map.set(
      conversationId,
      arr.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
    emit();
  },
  remove(conversationId: string, id: string) {
    const arr = map.get(conversationId);
    if (!arr) return;
    map.set(
      conversationId,
      arr.filter((m) => m.id !== id)
    );
    emit();
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useOptimisticMessages(conversationId: string | null): OptimisticMessage[] {
  return useSyncExternalStore(
    optimisticStore.subscribe,
    () => (conversationId ? optimisticStore.get(conversationId) : EMPTY),
    () => EMPTY
  );
}

/**
 * Merge server messages with optimistic messages.
 * An optimistic message is dropped when a server message matches by:
 *  - external_id in payload, OR
 *  - same type + same body within 30s of created_at
 */
export function mergeWithOptimistic(
  server: MessageRow[],
  optimistic: OptimisticMessage[]
): MessageRow[] {
  if (!optimistic.length) return server;
  const remaining = optimistic.filter((o) => {
    const oBody = (o.payload as Record<string, unknown> | null)?.body ?? null;
    const oExt = o._externalId ?? null;
    return !server.some((s) => {
      const sPayload = (s.payload ?? {}) as Record<string, unknown>;
      if (oExt && sPayload.external_id === oExt) return true;
      if (s.direction !== "out") return false;
      if (s.type !== o.type) return false;
      const sBody = sPayload.body ?? null;
      if ((oBody ?? "") !== (sBody ?? "")) return false;
      const dt = Math.abs(+new Date(s.created_at) - +new Date(o.created_at));
      return dt < 30_000;
    });
  });
  if (!remaining.length) return server;
  return [...server, ...remaining].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at)
  );
}

export function makeOptimistic(params: {
  conversationId: string;
  type: string;
  body?: string;
  extraPayload?: Record<string, unknown>;
}): OptimisticMessage {
  const id = "temp-" + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const now = new Date().toISOString();
  return {
    id,
    conversation_id: params.conversationId,
    direction: "out",
    type: params.type,
    payload: { body: params.body ?? "", ...(params.extraPayload ?? {}), _optimistic: true },
    status: "sending",
    created_at: now,
    sent_at: null,
    delivered_at: null,
    read_at: null,
    _optimistic: true,
  };
}

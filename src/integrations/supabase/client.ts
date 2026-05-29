import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  // eslint-disable-next-line no-console
  console.error("Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env");
}

declare global {
  // eslint-disable-next-line no-var
  var __darkfunnel_supabase: SupabaseClient | undefined;
}

// Singleton garantido — evita "Multiple GoTrueClient instances" e race no refresh_token.
// Vide DEBUG-221.
export const supabase: SupabaseClient =
  globalThis.__darkfunnel_supabase ??
  (globalThis.__darkfunnel_supabase = createClient(url, anon, {
    auth: {
      storageKey: "sb-sbyslxhjjfcqlxaehidw-auth-token",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      // Serializa refresh entre abas e entre eventuais instâncias do mesmo bundle.
      lock: async (name, _acquireTimeout, fn) => {
        // @ts-ignore - LockManager pode não existir em browsers antigos
        if (typeof navigator !== "undefined" && navigator?.locks?.request) {
          // @ts-ignore
          return navigator.locks.request(name, { mode: "exclusive" }, fn);
        }
        return fn();
      },
    },
    realtime: { params: { eventsPerSecond: 10 } },
    global: { headers: { "x-client-info": "darkfunnel-web" } },
  }));

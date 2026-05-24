import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Twilio?: any;
  }
}

export type DeviceStatus = "uninitialized" | "loading" | "ready" | "busy" | "error";

export function useVoiceDevice(enabled: boolean) {
  const deviceRef = useRef<any>(null);
  const connRef = useRef<any>(null);
  const [status, setStatus] = useState<DeviceStatus>("uninitialized");
  const [identity, setIdentity] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading");
        const { data, error: invokeErr } = await supabase.functions.invoke("voice-token");
        if (invokeErr) throw invokeErr;
        if (!data?.token) throw new Error("voice-token sem token");
        if (cancelled) return;
        if (!window.Twilio?.Device) throw new Error("Twilio SDK não carregou");
        const device = new window.Twilio.Device(data.token, { codecPreferences: ["opus", "pcmu"] });
        device.on("ready", () => setStatus("ready"));
        device.on("error", (e: any) => { setError(e?.message ?? "erro"); setStatus("error"); });
        device.on("disconnect", () => {
          setCallActive(false);
          connRef.current = null;
          setStatus("ready");
        });
        device.on("connect", (c: any) => {
          connRef.current = c;
          setCallActive(true);
          setStatus("busy");
        });
        deviceRef.current = device;
        setIdentity(data.identity ?? null);
        setStatus("ready");
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? String(e));
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
      try { deviceRef.current?.destroy?.(); } catch {}
      deviceRef.current = null;
    };
  }, [enabled]);

  const connect = useCallback((params: Record<string, string>) => {
    if (!deviceRef.current) return null;
    const c = deviceRef.current.connect(params);
    connRef.current = c;
    return c;
  }, []);

  const hangup = useCallback(() => {
    try { deviceRef.current?.disconnectAll?.(); } catch {}
    connRef.current = null;
    setCallActive(false);
  }, []);

  const sendDigit = useCallback((d: string) => {
    try { connRef.current?.sendDigits?.(d); } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    const c = connRef.current;
    if (!c) return;
    const next = !muted;
    try { c.mute?.(next); setMuted(next); } catch {}
  }, [muted]);

  return { status, identity, error, muted, callActive, connect, hangup, sendDigit, toggleMute };
}

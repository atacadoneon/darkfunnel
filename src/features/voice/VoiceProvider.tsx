import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type DialerPrefill = {
  contactId?: string | null;
  contactName?: string | null;
  contactAvatar?: string | null;
  phone?: string | null;
  channel?: "pstn" | "whatsapp";
  conversationId?: string | null;
  dealId?: string | null;
};

type VoiceCtx = {
  isOpen: boolean;
  prefill: DialerPrefill | null;
  open: (p?: DialerPrefill) => void;
  close: () => void;
  insufficient: { open: boolean; required?: number };
  showInsufficient: (required?: number) => void;
  hideInsufficient: () => void;
};

const Ctx = createContext<VoiceCtx | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<DialerPrefill | null>(null);
  const [insufficient, setInsufficient] = useState<{ open: boolean; required?: number }>({ open: false });

  const open = useCallback((p?: DialerPrefill) => {
    setPrefill(p ?? null);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const showInsufficient = useCallback((required?: number) => setInsufficient({ open: true, required }), []);
  const hideInsufficient = useCallback(() => setInsufficient({ open: false }), []);

  return (
    <Ctx.Provider value={{ isOpen, prefill, open, close, insufficient, showInsufficient, hideInsufficient }}>
      {children}
    </Ctx.Provider>
  );
}

export function useDialer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDialer must be used inside VoiceProvider");
  return ctx;
}

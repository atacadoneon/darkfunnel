import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function GoogleCallback() {
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const stateRaw = params.get("state");
    const errorParam = params.get("error");

    if (errorParam) {
      toast.error(`Google: ${errorParam}`);
      navigate("/agenda", { replace: true });
      return;
    }
    if (!code || !stateRaw) {
      toast.error("Callback inválido");
      navigate("/agenda", { replace: true });
      return;
    }
    let workspace_id: string | undefined;
    try {
      workspace_id = JSON.parse(stateRaw).workspace_id;
    } catch {
      /* noop */
    }

    supabase.functions
      .invoke("google-oauth", {
        body: { action: "exchange_code", code, workspace_id },
      })
      .then(({ data, error }) => {
        if (data?.ok) {
          toast.success(`Google Calendar conectado: ${data.account_email ?? ""}`);
        } else {
          toast.error(data?.error || error?.message || "Falha ao conectar");
        }
        navigate("/agenda", { replace: true });
      });
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        <p className="mt-3 text-sm">Conectando Google Calendar...</p>
      </div>
    </div>
  );
}

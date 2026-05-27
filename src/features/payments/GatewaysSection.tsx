import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CreditCard, CheckCircle2, AlertCircle, Loader2, Star } from "lucide-react";
import { PROVIDERS, type PaymentGateway } from "./types";
import { useDisconnectGateway, useGateways, useSetDefaultGateway, testGatewayConnection } from "./hooks";
import { GatewayConfigDialog } from "./GatewayConfigDialog";
import { toast } from "sonner";

export function GatewaysSection() {
  const { data: gateways = [], isLoading } = useGateways();
  const setDefault = useSetDefaultGateway();
  const disconnect = useDisconnectGateway();
  const [editing, setEditing] = useState<{ providerKey: string } | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const byProvider = useMemo(() => {
    const map = new Map<string, PaymentGateway>();
    gateways.forEach((g) => map.set(g.provider, g));
    return map;
  }, [gateways]);

  const handleTest = async (g: PaymentGateway) => {
    setTestingId(g.id);
    try {
      const r = await testGatewayConnection(g.provider, (g.credentials_encrypted ?? {}) as any);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          <h2 className="text-base font-semibold">Gateways de Pagamento</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Conecte seu gateway e gere links de pagamento direto pelo WhatsApp.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROVIDERS.map((p) => {
            const g = byProvider.get(p.provider);
            const isConfigured = g?.status === "configured";
            const isError = g?.status === "error";
            return (
              <Card key={p.provider} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="h-10 w-10 rounded-md flex items-center justify-center text-white font-bold text-xs"
                      style={{ background: p.brand }}
                    >
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{p.name}</h3>
                        {g?.is_default && <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{p.subtitle}</p>
                    </div>
                  </div>
                  {isConfigured ? (
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Conectado
                    </Badge>
                  ) : isError ? (
                    <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10 gap-1">
                      <AlertCircle className="h-3 w-3" /> Erro
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Não conectado</Badge>
                  )}
                </div>

                {isConfigured && (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      Ambiente: {(g!.credentials_encrypted as any)?.environment === "production" ? "Produção" : "Sandbox"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">Padrão</span>
                      <Switch
                        checked={!!g!.is_default}
                        onCheckedChange={() => !g!.is_default && setDefault.mutate(g!.id)}
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-auto">
                  {isConfigured ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setEditing({ providerKey: p.provider })}>
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleTest(g!)} disabled={testingId === g!.id}>
                        {testingId === g!.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Testar"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive ml-auto"
                        onClick={() => disconnect.mutate(g!.id)}
                      >
                        Desconectar
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" onClick={() => setEditing({ providerKey: p.provider })}>
                      Conectar
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        {isLoading && <p className="text-xs text-muted-foreground mt-2">Carregando...</p>}
      </section>

      <section>
        <h2 className="text-base font-semibold mb-3">Outras Integrações</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: "Stripe", brand: "#635BFF" },
            { name: "Asaas", brand: "#1E88E5" },
            { name: "PagSeguro", brand: "#FFCC00" },
          ].map((o) => (
            <Card key={o.name} className="p-4 opacity-60">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md flex items-center justify-center text-white font-bold text-xs" style={{ background: o.brand }}>
                  {o.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold">{o.name}</h3>
                  <Badge variant="outline" className="mt-1 text-xs">Em breve</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {editing && (() => {
        const meta = PROVIDERS.find((p) => p.provider === editing.providerKey)!;
        return (
          <GatewayConfigDialog
            open
            onOpenChange={(o) => !o && setEditing(null)}
            meta={meta}
            existing={byProvider.get(meta.provider) ?? null}
          />
        );
      })()}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Search, Plug, Loader2 } from "lucide-react";
import { useIntegrationsCatalog, useIntegrationConnections, useConnectIntegration, useDisconnectIntegration, type IntegrationCatalogItem } from "@/features/settings/settingsHooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

const DEFAULT_FIELDS: Record<string, { label: string; key: string; type?: string }[]> = {
  default: [{ label: "API Key", key: "api_key" }, { label: "API Secret", key: "api_secret" }],
  google_calendar: [{ label: "Client ID", key: "client_id" }, { label: "Client Secret", key: "client_secret", type: "password" }],
  google_meet: [{ label: "Client ID", key: "client_id" }, { label: "Client Secret", key: "client_secret", type: "password" }],
  stripe: [{ label: "Secret Key", key: "secret_key", type: "password" }, { label: "Publishable Key", key: "publishable_key" }],
};

export default function IntegracoesPage() {
  const { data: catalog = [], isLoading } = useIntegrationsCatalog();
  const { data: connections = [] } = useIntegrationConnections();
  const connect = useConnectIntegration();
  const disconnect = useDisconnectIntegration();
  const canEdit = useIsManagerOrAdmin();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<IntegrationCatalogItem | null>(null);

  const filtered = useMemo(
    () => catalog.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase())),
    [catalog, search],
  );

  const isConnected = (id: string) => connections.find((c) => c.integration_id === id && c.status === "active");

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
          <p className="text-sm text-muted-foreground">Conecte ferramentas externas ao DarkFunnel.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar integração…" className="pl-9 w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </header>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filtered.map((it) => {
            const conn = isConnected(it.id);
            const isTiny = it.slug === "tiny_erp";
            return (
              <Card key={it.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    {it.icon_url ? <img src={it.icon_url} alt={it.name} className="h-8 w-8" /> : <Plug className="h-5 w-5 text-violet-600" />}
                  </div>
                  {conn && <Badge className="bg-emerald-600 hover:bg-emerald-600">Conectado</Badge>}
                </div>
                <div>
                  <h3 className="font-semibold">{it.name}</h3>
                  <p className="text-xs text-muted-foreground">{it.category}</p>
                </div>
                <p className="text-sm text-muted-foreground flex-1 line-clamp-3">{it.description}</p>
                {isTiny ? (
                  <Button
                    disabled={!canEdit}
                    onClick={() => navigate("/settings/integracoes/tiny")}
                    variant={conn ? "outline" : "default"}
                    className={conn ? "" : "bg-violet-600 hover:bg-violet-700 text-white"}
                  >
                    {conn ? "Configurar" : "Conectar"}
                  </Button>
                ) : conn ? (
                  <Button variant="outline" disabled={!canEdit} onClick={() => disconnect.mutate(conn.id)}>Desconectar</Button>
                ) : (
                  <Button disabled={!canEdit} onClick={() => setEditing(it)} className="bg-violet-600 hover:bg-violet-700 text-white">Conectar</Button>
                )}
              </Card>
            );
          })}
        </div>
      )}


      <ConnectDialog item={editing} onClose={() => setEditing(null)} onSave={async (creds) => {
        if (!editing) return;
        await connect.mutateAsync({ integration_id: editing.id, credentials_jsonb: creds });
        setEditing(null);
      }} pending={connect.isPending} />
    </div>
  );
}

function ConnectDialog({ item, onClose, onSave, pending }: { item: IntegrationCatalogItem | null; onClose: () => void; onSave: (c: Record<string, unknown>) => Promise<void>; pending: boolean }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const fields = item ? (DEFAULT_FIELDS[item.slug] ?? DEFAULT_FIELDS.default) : [];

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar {item?.name}</DialogTitle>
          <DialogDescription>Informe as credenciais de acesso.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input type={f.type ?? "text"} value={vals[f.key] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(vals)} disabled={pending} className="bg-violet-600 hover:bg-violet-700 text-white">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

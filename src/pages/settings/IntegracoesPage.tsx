import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Search, Plug } from "lucide-react";
import {
  useIntegrationsCatalog,
  useIntegrationConnections,
  type IntegrationCatalogItem,
} from "@/features/settings/settingsHooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";
import { IntegrationCredentialsCard } from "@/features/integrations/IntegrationCredentialsCard";

const DEDICATED_ROUTES: Record<string, string> = {
  tiny_erp: "/settings/integracoes/tiny",
  bling: "/settings/integracoes/bling",
};

export default function IntegracoesPage() {
  const { data: catalog = [], isLoading } = useIntegrationsCatalog();
  const { data: connections = [] } = useIntegrationConnections();
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
            const dedicated = DEDICATED_ROUTES[it.slug];
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
                {dedicated ? (
                  <Button
                    disabled={!canEdit}
                    onClick={() => navigate(dedicated)}
                    variant={conn ? "outline" : "default"}
                    className={conn ? "" : "bg-violet-600 hover:bg-violet-700 text-white"}
                  >
                    {conn ? "Gerenciar" : "Configurar"}
                  </Button>
                ) : (
                  <Button
                    disabled={!canEdit}
                    onClick={() => setEditing(it)}
                    variant={conn ? "outline" : "default"}
                    className={conn ? "" : "bg-violet-600 hover:bg-violet-700 text-white"}
                  >
                    Configurar
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CredentialsSheet item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function CredentialsSheet({ item, onClose }: { item: IntegrationCatalogItem | null; onClose: () => void }) {
  const authType = (item as any)?.auth_type ?? "custom";
  const showRedirect = authType === "oauth2";

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        {item && (
          <>
            <SheetHeader className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  {item.icon_url ? <img src={item.icon_url} alt={item.name} className="h-8 w-8" /> : <Plug className="h-5 w-5 text-violet-600" />}
                </div>
                <div className="flex-1">
                  <SheetTitle>{item.name}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2">
                    <span>{item.category}</span>
                    <Badge variant="outline" className="capitalize">{String(authType).replace("_", " ")}</Badge>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-6">
              <IntegrationCredentialsCard
                slug={item.slug}
                name={item.name}
                showRedirectUri={showRedirect}
              />
            </div>

            <SheetFooter className="mt-6">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

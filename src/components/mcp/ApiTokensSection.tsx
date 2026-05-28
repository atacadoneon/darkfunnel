import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, KeyRound } from "lucide-react";
import { useMcpTokens, useRevokeMcpToken } from "@/hooks/useMcpTokens";
import { CreateTokenDialog } from "./CreateTokenDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ApiTokensSection() {
  const { data: tokens = [] } = useMcpTokens();
  const revoke = useRevokeMcpToken();
  const [openCreate, setOpenCreate] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" /> API Tokens</h3>
        <Button size="sm" onClick={() => setOpenCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Criar Token
        </Button>
      </div>

      {tokens.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">
          Nenhum token criado ainda.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Prefix</th>
                <th className="text-left px-3 py-2">Escopos</th>
                <th className="text-left px-3 py-2">Último uso</th>
                <th className="text-left px-3 py-2">Expira</th>
                <th className="text-right px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  <td className="px-3 py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">{t.prefix}…</code></td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(t.scopes ?? []).map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {t.last_used_at ? formatDistanceToNow(new Date(t.last_used_at), { addSuffix: true, locale: ptBR }) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {t.expires_at ? new Date(t.expires_at).toLocaleDateString("pt-BR") : "Nunca"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => revoke.mutate(t.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <CreateTokenDialog open={openCreate} onOpenChange={setOpenCreate} />
    </div>
  );
}

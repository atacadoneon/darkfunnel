import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, FileText, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuickProposalDialog } from "./QuickProposalDialog";
import { useLeadPurchases, useLeadProposals } from "@/hooks/useLeadProposals";

const BRL = (cents: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(((cents ?? 0)) / 100);

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_aberto: "Em aberto",
  aguardando: "Aguardando",
  aprovada: "Aprovada",
  nao_aprovada: "Não aprovada",
  concluida: "Concluída",
  cancelada: "Cancelada",
  modelo: "Modelo",
};

function statusBadge(status: string) {
  const label = STATUS_LABEL[status] ?? status;
  const cls = (() => {
    switch (status) {
      case "rascunho":
        return "bg-muted text-muted-foreground border-transparent";
      case "em_aberto":
      case "aguardando":
        return "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400";
      case "aprovada":
      case "concluida":
        return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400";
      case "nao_aprovada":
      case "cancelada":
        return "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400";
      case "modelo":
        return "border-foreground/30 text-foreground bg-transparent";
      default:
        return "bg-muted text-muted-foreground border-transparent";
    }
  })();
  return <Badge variant="outline" className={cls}>{label}</Badge>;
}

type Props = { leadId: string; dealId?: string | null };

export function LeadProposalsSection({ leadId, dealId }: Props) {
  const navigate = useNavigate();
  const [quickOpen, setQuickOpen] = useState(false);
  const { data: purchases = [] } = useLeadPurchases(leadId);
  const { data: proposals = [] } = useLeadProposals(leadId);

  const openFull = () => {
    const params = new URLSearchParams({ lead: leadId });
    if (dealId) params.set("deal", dealId);
    navigate(`/propostas/novo?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold">Compras & Propostas</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setQuickOpen(true)}>
            <Zap className="h-3.5 w-3.5 mr-1" /> Proposta Rápida
          </Button>
          <Button size="sm" variant="outline" onClick={openFull}>
            <FileText className="h-3.5 w-3.5 mr-1" /> Proposta Completa
          </Button>
        </div>
      </div>

      {/* Compras */}
      <div className="space-y-2">
        <div className="text-sm font-medium inline-flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" /> Compras ({purchases.length})
        </div>
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Nenhuma compra ainda.</p>
        ) : (
          <div className="space-y-2">
            {purchases.map((p) => (
              <Card key={p.id} className="p-3 flex items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.product_name}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(p.purchased_at)}</div>
                </div>
                <div className="font-semibold">{BRL(p.value_cents)}</div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Propostas */}
      <div className="space-y-2">
        <div className="text-sm font-medium inline-flex items-center gap-2">
          <FileText className="h-4 w-4" /> Propostas ({proposals.length})
        </div>
        {proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Nenhuma proposta criada.</p>
        ) : (
          <div className="space-y-2">
            {proposals.map((pr) => {
              const title = `${pr.series ?? "P"}-${String(pr.number ?? "—").padStart(4, "0")}`;
              return (
                <Card
                  key={pr.id}
                  className="p-3 flex items-center gap-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => navigate(`/propostas/${pr.id}/edit`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {title}
                      {pr.customer_name ? <span className="text-muted-foreground"> · {pr.customer_name}</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(pr.created_at)}</div>
                  </div>
                  {statusBadge(pr.status)}
                  <div className="font-semibold">{BRL(pr.total_cents)}</div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <QuickProposalDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        leadId={leadId}
        dealId={dealId ?? null}
      />
    </div>
  );
}

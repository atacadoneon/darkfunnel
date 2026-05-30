import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQuickProposal } from "@/hooks/useLeadProposals";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  dealId?: string | null;
};

function parseBRLToCents(input: string): number | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits);
}

function formatBRLMask(input: string): string {
  const cents = parseBRLToCents(input) ?? 0;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function QuickProposalDialog({ open, onOpenChange, leadId, dealId }: Props) {
  const [productName, setProductName] = useState("");
  const [valueStr, setValueStr] = useState("");
  const quick = useQuickProposal();

  const reset = () => { setProductName(""); setValueStr(""); };

  const submit = async () => {
    const name = productName.trim();
    if (!name) { toast.error("Informe o tipo de produto"); return; }
    const cents = parseBRLToCents(valueStr);
    if (cents == null || cents <= 0) { toast.error("Valor inválido"); return; }
    try {
      await quick.mutateAsync({ leadId, productName: name, totalCents: cents, dealId: dealId ?? null });
      toast.success("Proposta rascunho criada");
      reset();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar proposta";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Proposta Rápida</DialogTitle>
          <DialogDescription>
            Crie uma proposta em rascunho com 1 item. Você pode editar depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qp-prod">Tipo do produto</Label>
            <Input
              id="qp-prod"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex.: Consultoria mensal"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qp-val">Valor total</Label>
            <Input
              id="qp-val"
              value={valueStr}
              onChange={(e) => setValueStr(formatBRLMask(e.target.value))}
              placeholder="R$ 0,00"
              inputMode="decimal"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={quick.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={quick.isPending}>
            {quick.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

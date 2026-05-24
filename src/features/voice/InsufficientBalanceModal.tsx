import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet as WalletIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDialer } from "./VoiceProvider";
import { formatBRL } from "@/features/wallet/hooks";

export function InsufficientBalanceModal() {
  const { insufficient, hideInsufficient } = useDialer();
  const navigate = useNavigate();
  return (
    <Dialog open={insufficient.open} onOpenChange={(o) => !o && hideInsufficient()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WalletIcon className="h-5 w-5 text-orange-500" />
            Saldo insuficiente
          </DialogTitle>
          <DialogDescription>
            Adicione créditos para continuar fazendo ligações VoIP.
            {insufficient.required ? ` Necessário aproximadamente ${formatBRL(insufficient.required)}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={hideInsufficient}>Cancelar</Button>
          <Button onClick={() => { hideInsufficient(); navigate("/settings/wallet"); }}>
            Adicionar saldo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Wallet as WalletIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWallet, formatBRL } from "./hooks";

export function WalletWidget() {
  const { data, isLoading } = useWallet();
  const navigate = useNavigate();
  const balance = data?.balance_cents ?? 0;
  const low = data?.low_balance_alert_cents ?? 0;
  const isLow = low > 0 && balance <= low;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-8 gap-1.5 px-2 font-medium ${isLow ? "text-orange-500" : ""}`}
        >
          <WalletIcon className="h-4 w-4" />
          {isLoading ? "—" : formatBRL(balance)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => navigate("/settings/wallet")}>
          Adicionar saldo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings/wallet?tab=history")}>
          Histórico
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings/wallet?tab=numbers")}>
          Números (BINA)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings/wallet?tab=pricing")}>
          Tarifas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

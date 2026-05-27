import { Moon, Sun, LogOut } from "lucide-react";
import { UnreadBell } from "@/features/notifications/UnreadBell";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CallPill } from "@/features/voice/CallPill";
import { WalletWidget } from "@/features/wallet/WalletWidget";
import { AiHelpButton } from "@/features/ai/AiHelpButton";

export function AppTopbar() {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();

  return (
    <header className="h-14 shrink-0 border-b flex items-center gap-3 px-3">
      <SidebarTrigger />
      <span className="font-semibold tracking-tight">DarkFunnel</span>
      <div className="ml-auto flex items-center gap-2">
        <CallPill />
        <WalletWidget />
        <AiHelpButton />
        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Tema">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">{user?.email}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

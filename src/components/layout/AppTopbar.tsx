import { Moon, Sun } from "lucide-react";
import { UnreadBell } from "@/features/notifications/UnreadBell";
import { Button } from "@/components/ui/button";

import { useTheme } from "@/components/theme/ThemeProvider";
import { CallPill } from "@/features/voice/CallPill";
import { WalletWidget } from "@/features/wallet/WalletWidget";
import { AiHelpButton } from "@/features/ai/AiHelpButton";
import { UserDropdown } from "@/components/layout/UserDropdown";

export function AppTopbar() {
  const { theme, toggle } = useTheme();

  return (
    <header className="h-14 shrink-0 border-b flex items-center gap-3 px-3">
      <span className="font-semibold tracking-tight pl-2">DarkFunnel</span>
      <div className="ml-auto flex items-center gap-2">
        <CallPill />
        <WalletWidget />
        <AiHelpButton />
        <UnreadBell />
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Tema">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <UserDropdown />
      </div>
    </header>
  );
}

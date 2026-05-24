import { Phone, MessageCircle } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDialer, type DialerPrefill } from "./VoiceProvider";
import { cn } from "@/lib/utils";

type Props = {
  phone?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  contactAvatar?: string | null;
  conversationId?: string | null;
  dealId?: string | null;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  iconOnly?: boolean;
  className?: string;
};

export function CallButton({
  phone, contactId, contactName, contactAvatar, conversationId, dealId,
  variant = "ghost", size = "sm", iconOnly, className,
}: Props) {
  const { open } = useDialer();
  const prefill = (channel: "pstn" | "whatsapp"): DialerPrefill => ({
    phone, contactId, contactName, contactAvatar, conversationId, dealId, channel,
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={iconOnly ? "icon" : size}
          className={cn(iconOnly && "h-8 w-8", className)}
          onClick={(e) => e.stopPropagation()}
          title="Ligar"
        >
          <Phone className="h-4 w-4" />
          {!iconOnly && <span className="ml-1.5">Ligar</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => open(prefill("pstn"))}>
          <Phone className="h-4 w-4 mr-2 text-sky-500" />
          Ligar via VoIP
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(prefill("whatsapp"))}>
          <MessageCircle className="h-4 w-4 mr-2 text-emerald-500" />
          Ligar via WhatsApp <span className="ml-auto text-xs text-emerald-600">grátis</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useConversations, useMessages } from "./hooks";
import { MessageThread } from "./MessageThread";
import { Composer } from "./Composer";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contactId: string | null;
  contactLabel?: string;
};

export function ConversationPopup({ open, onOpenChange, contactId, contactLabel }: Props) {
  const { data: conversations = [], isLoading } = useConversations();

  const conversation = useMemo(() => {
    if (!contactId) return null;
    const matches = conversations.filter((c) => c.contact_id === contactId);
    if (matches.length === 0) return null;
    const open = matches.find((c) => c.status === "open");
    return open ?? matches[0];
  }, [conversations, contactId]);

  const { data: messages = [] } = useMessages(conversation?.id ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden h-[80vh] flex flex-col">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base truncate">
            Conversa · {contactLabel ?? "lead"}
          </DialogTitle>
          {conversation && (
            <Button variant="ghost" size="sm" asChild className="gap-1 mr-6">
              <Link to={`/inbox?conversation=${conversation.id}`} onClick={() => onOpenChange(false)}>
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir na Inbox
              </Link>
            </Button>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : !conversation ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
            Nenhuma conversa encontrada para este contato.
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-hidden">
              <MessageThread messages={messages} />
            </div>
            <Composer conversation={conversation} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

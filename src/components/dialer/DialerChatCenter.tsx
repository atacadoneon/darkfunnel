import { Loader2, MessageSquare } from "lucide-react";
import { useLeadConversation } from "@/hooks/useLeadConversation";
import { useConversationById, useMessages } from "@/features/inbox/hooks";
import { ConversationHeader } from "@/features/inbox/ConversationHeader";
import { MessageThread } from "@/features/inbox/MessageThread";
import { Composer } from "@/features/inbox/Composer";

/**
 * Centro do discador: reusa os componentes do /chats sem duplicar lógica.
 * - ConversationHeader (cabeçalho)
 * - MessageThread (bubbles + scroll)
 * - Composer (input rodapé)
 */
export function DialerChatCenter({ leadId }: { leadId: string | null }) {
  const { data: conversationId, isLoading: loadingConv } = useLeadConversation(leadId);
  const { data: conversation } = useConversationById(conversationId ?? null);
  const { data: messages = [] } = useMessages(conversationId ?? null);

  if (!leadId) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Selecione um lead na lista à esquerda para ver a conversa.
        </p>
      </div>
    );
  }

  if (loadingConv || (conversationId && !conversation)) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando conversa...
      </div>
    );
  }

  if (!conversationId || !conversation) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div>
          <MessageSquare className="h-12 w-12 mx-auto opacity-30 mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Este lead ainda não tem conversa.
          </p>
          <p className="text-xs mt-1 text-muted-foreground">
            Inicie enviando uma mensagem ou ligando.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
      <ConversationHeader conversation={conversation} />
      <div className="flex-1 min-h-0 overflow-hidden">
        <MessageThread
          messages={messages}
          contactAvatar={conversation.contacts?.profile_pic_url ?? null}
        />
      </div>
      <Composer conversation={conversation} />
    </div>
  );
}

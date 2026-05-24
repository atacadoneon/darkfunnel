import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RefreshMediaResponse = {
  ok: boolean;
  media_url: string;
  persisted_in_storage: boolean;
};

export function useRefreshMedia(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string): Promise<RefreshMediaResponse> => {
      const { data, error } = await supabase.functions.invoke("refresh-media", {
        body: { message_id: messageId },
      });
      if (error) throw error;
      if (!data?.ok || !data?.media_url) throw new Error("Resposta inválida do servidor");
      return data as RefreshMediaResponse;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      toast.success(data.persisted_in_storage ? "Mídia recarregada e armazenada" : "Mídia recarregada");
    },
    onError: () => {
      toast.error("Não foi possível recarregar a mídia");
    },
  });
}

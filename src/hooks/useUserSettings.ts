import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "@/types/userSettings";

export function useUserSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["user-settings", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { user_id: user!.id, ...DEFAULT_USER_SETTINGS };
      return data as UserSettings;
    },
    staleTime: 60_000,
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<UserSettings>) => {
      if (!user) throw new Error("Sem usuário");
      const payload = { user_id: user.id, ...DEFAULT_USER_SETTINGS, ...(query.data ?? {}), ...patch };
      const { data, error } = await supabase
        .from("user_settings")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .single();
      if (error) throw error;
      return data as UserSettings;
    },
    onSuccess: (data) => {
      qc.setQueryData(["user-settings", user?.id], data);
    },
  });

  return { ...query, update };
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OAuthAppSlug = "tiny_erp" | "bling";

export type OAuthAppMetadata = {
  id: string;
  workspace_id: string;
  integration_slug: string;
  client_id: string;
  redirect_uri: string | null;
  scopes: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  has_secret: boolean;
};

export function useOAuthAppMetadata(slug: OAuthAppSlug) {
  return useQuery({
    queryKey: ["oauth_app_metadata", slug],
    queryFn: async (): Promise<OAuthAppMetadata | null> => {
      const { data, error } = await (supabase as any).rpc("get_oauth_app_metadata", {
        p_integration_slug: slug,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as OAuthAppMetadata) ?? null;
    },
  });
}

export function useSetOAuthApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      slug: OAuthAppSlug;
      clientId: string;
      clientSecret: string;
      redirectUri?: string | null;
      scopes?: string[] | null;
    }) => {
      const { data, error } = await (supabase as any).rpc("set_oauth_app", {
        p_integration_slug: args.slug,
        p_client_id: args.clientId,
        p_client_secret: args.clientSecret,
        p_redirect_uri: args.redirectUri ?? null,
        p_scopes: args.scopes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["oauth_app_metadata", vars.slug] });
    },
  });
}

export function useDeleteOAuthApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slug: OAuthAppSlug) => {
      const { data, error } = await (supabase as any).rpc("delete_oauth_app", {
        p_integration_slug: slug,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: (_d, slug) => {
      qc.invalidateQueries({ queryKey: ["oauth_app_metadata", slug] });
    },
  });
}

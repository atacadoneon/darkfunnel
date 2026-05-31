import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOAuthAppMetadata } from "@/hooks/useOAuthApps";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

type FieldDef = {
  key: string;
  label?: string;
  type?: string;
  sensitive?: boolean;
  placeholder?: string;
  required?: boolean;
  help?: string;
};

type CatalogRow = {
  auth_type: string | null;
  credentials_schema_jsonb: any;
};

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? "https://sbyslxhjjfcqlxaehidw.supabase.co";

function parseFields(schema: any): FieldDef[] {
  if (!schema) return [];
  if (Array.isArray(schema)) return schema as FieldDef[];
  if (Array.isArray(schema.fields)) return schema.fields as FieldDef[];
  // Object map: { key: { ... } }
  if (typeof schema === "object") {
    return Object.entries(schema).map(([key, v]: [string, any]) => ({ key, ...(v ?? {}) }));
  }
  return [];
}

function callbackPath(slug: string): string {
  const base = slug.replace(/_erp$/, "").replace(/_/g, "-");
  return `${base}-oauth-callback`;
}

export interface IntegrationCredentialsCardProps {
  slug: string;
  name: string;
  helpUrl?: string;
  showRedirectUri?: boolean;
}

export function IntegrationCredentialsCard({ slug, name, helpUrl, showRedirectUri }: IntegrationCredentialsCardProps) {
  const qc = useQueryClient();
  const canEdit = useIsManagerOrAdmin();

  const { data: catalog, isLoading: loadingCatalog } = useQuery({
    queryKey: ["integration_catalog_schema", slug],
    queryFn: async (): Promise<CatalogRow | null> => {
      const { data, error } = await supabase
        .from("integrations_catalog")
        .select("auth_type, credentials_schema_jsonb")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data as CatalogRow) ?? null;
    },
  });

  const { data: metadata, isLoading: loadingMeta } = useOAuthAppMetadata(slug as any);

  const fields = useMemo<FieldDef[]>(() => parseFields(catalog?.credentials_schema_jsonb), [catalog]);
  const authType = catalog?.auth_type ?? "custom";
  const isOAuth = authType === "oauth2";
  const renderRedirect = !!showRedirectUri && isOAuth;
  const redirectUri = `${SUPABASE_URL}/functions/v1/${callbackPath(slug)}`;
  const hasSecret = !!metadata?.has_secret;

  const [values, setValues] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  // Pre-fill non-sensitive values from metadata
  useEffect(() => {
    if (!fields.length) return;
    const next: Record<string, string> = {};
    const extra = (metadata as any)?.extra_metadata ?? {};
    for (const f of fields) {
      if (f.sensitive) continue;
      if (f.key === "client_id" && metadata?.client_id) next[f.key] = metadata.client_id;
      else if (extra && typeof extra === "object" && extra[f.key] != null) next[f.key] = String(extra[f.key]);
    }
    setValues((prev) => ({ ...next, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.length, metadata?.client_id]);

  const saveMut = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const { error } = await (supabase as any).rpc("set_integration_credentials", {
        p_integration_slug: slug,
        p_credentials: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credenciais salvas");
      qc.invalidateQueries({ queryKey: ["oauth_app_metadata", slug] });
      // Clear sensitive inputs after save
      setValues((prev) => {
        const next = { ...prev };
        for (const f of fields) if (f.sensitive) next[f.key] = "";
        return next;
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  function copyRedirect() {
    navigator.clipboard.writeText(redirectUri);
    toast.success("URL copiada");
  }

  function onSave() {
    const payload: Record<string, any> = {};
    for (const f of fields) {
      const v = values[f.key];
      if (v && v.length > 0) payload[f.key] = v;
    }
    if (renderRedirect) payload.redirect_uri = redirectUri;
    // Validate required
    for (const f of fields) {
      if (f.required && f.sensitive && !values[f.key] && !hasSecret) {
        toast.error(`Preencha ${f.label ?? f.key}`);
        return;
      }
      if (f.required && !f.sensitive && !values[f.key]) {
        toast.error(`Preencha ${f.label ?? f.key}`);
        return;
      }
    }
    if (Object.keys(payload).length === 0) {
      toast.error("Nada para salvar");
      return;
    }
    saveMut.mutate(payload);
  }

  const loading = loadingCatalog || loadingMeta;

  return (
    <Card id="oauth-credentials-card" className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Credenciais — {name}</CardTitle>
            <CardDescription>
              Cadastre as credenciais de acesso à API do {name}.{" "}
              {helpUrl && (
                <a href={helpUrl} target="_blank" rel="noreferrer" className="underline">
                  Documentação
                </a>
              )}
            </CardDescription>
          </div>
          <Badge variant="outline" className="capitalize">{authType.replace("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum campo de credencial declarado para esta integração.
          </p>
        ) : (
          <>
            {fields.map((f) => {
              const label = f.label ?? f.key;
              const isPass = !!f.sensitive;
              const placeholder = f.placeholder ?? (isPass && hasSecret ? "••••••••••••••••" : `Cole o ${label}`);
              return (
                <div key={f.key} className="space-y-2">
                  <Label>{label}{f.required ? " *" : ""}</Label>
                  {isPass ? (
                    <div className="flex gap-2">
                      <Input
                        type={reveal[f.key] ? "text" : "password"}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={placeholder}
                        disabled={!canEdit}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setReveal((r) => ({ ...r, [f.key]: !r[f.key] }))}
                        aria-label={reveal[f.key] ? "Ocultar" : "Mostrar"}
                      >
                        {reveal[f.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : (
                    <Input
                      type={f.type ?? "text"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={placeholder}
                      disabled={!canEdit}
                    />
                  )}
                  {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                </div>
              );
            })}

            {renderRedirect && (
              <div className="space-y-2">
                <Label>Redirect URI (cadastre na sua app no {name})</Label>
                <div className="flex gap-2">
                  <Input readOnly value={redirectUri} className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={copyRedirect} aria-label="Copiar">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {hasSecret && (
              <p className="text-xs text-muted-foreground">
                Já existem credenciais salvas (cifradas). Preencha apenas os campos que deseja substituir.
              </p>
            )}

            {!canEdit ? (
              <p className="text-xs text-muted-foreground">
                Apenas proprietários ou gerentes podem cadastrar credenciais.
              </p>
            ) : (
              <div className="flex justify-end pt-2">
                <Button
                  onClick={onSave}
                  disabled={saveMut.isPending}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar credenciais
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

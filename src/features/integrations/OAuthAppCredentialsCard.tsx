import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Copy, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useDeleteOAuthApp, useOAuthAppMetadata, useSetOAuthApp, type OAuthAppSlug } from "@/hooks/useOAuthApps";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

const META: Record<OAuthAppSlug, { label: string; callback: string; helpUrl: string }> = {
  tiny_erp: { label: "Tiny", callback: "tiny-oauth-callback", helpUrl: "https://developers.tiny.com.br/" },
  bling:    { label: "Bling", callback: "bling-oauth-callback", helpUrl: "https://developer.bling.com.br/" },
};

export function OAuthAppCredentialsCard({ slug }: { slug: OAuthAppSlug }) {
  const meta = META[slug];
  const { data: metadata, isLoading } = useOAuthAppMetadata(slug);
  const setMut = useSetOAuthApp();
  const delMut = useDeleteOAuthApp();
  const canEdit = useIsManagerOrAdmin();

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${meta.callback}`;
  const hasSecret = !!metadata?.has_secret;

  useEffect(() => {
    if (metadata?.client_id) setClientId(metadata.client_id);
  }, [metadata?.client_id]);

  function copyRedirect() {
    navigator.clipboard.writeText(redirectUri);
    toast.success("URL copiada");
  }

  async function save() {
    try {
      await setMut.mutateAsync({ slug, clientId: clientId.trim(), clientSecret: clientSecret.trim(), redirectUri });
      setClientSecret("");
      toast.success("Credenciais salvas");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  }

  async function remove() {
    try {
      await delMut.mutateAsync(slug);
      setClientSecret("");
      toast.success("Credenciais removidas");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover");
    }
  }

  const saveDisabled =
    !canEdit || !clientId.trim() || (!clientSecret.trim() && !hasSecret) || setMut.isPending;

  return (
    <Card id="oauth-credentials-card" className="max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">Credenciais da aplicação OAuth</CardTitle>
        <CardDescription>
          Cadastre aqui o Client ID e Client Secret obtidos ao criar sua aplicação no {meta.label}.{" "}
          <a href={meta.helpUrl} target="_blank" rel="noreferrer" className="underline">
            Como criar app
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Cole o Client ID"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-2">
              <Label>Client Secret</Label>
              <div className="flex gap-2">
                <Input
                  type={showSecret ? "text" : "password"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={hasSecret ? "••••••••••••••••" : "Cole o Client Secret"}
                  disabled={!canEdit}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowSecret((v) => !v)}
                  aria-label={showSecret ? "Ocultar" : "Mostrar"}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {hasSecret && (
                <p className="text-xs text-muted-foreground">
                  Já existe um Client Secret salvo (cifrado). Preencha apenas para substituir.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Redirect URI (cadastre essa URL na sua app no {meta.label})</Label>
              <div className="flex gap-2">
                <Input readOnly value={redirectUri} className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyRedirect} aria-label="Copiar">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {!canEdit && (
              <p className="text-xs text-muted-foreground">
                Apenas proprietários ou gerentes podem cadastrar credenciais OAuth.
              </p>
            )}

            {canEdit && (
              <div className="flex justify-end gap-2 pt-2">
                {hasSecret && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" disabled={delMut.isPending}>Remover credenciais</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover credenciais OAuth?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A integração deixará de funcionar até que novas credenciais sejam cadastradas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={remove}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button
                  onClick={save}
                  disabled={saveDisabled}
                  className="bg-violet-600 hover:bg-violet-700 text-white"
                >
                  {setMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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

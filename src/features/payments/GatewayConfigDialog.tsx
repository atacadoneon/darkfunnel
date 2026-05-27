import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { PaymentGateway, ProviderMeta } from "./types";
import { testGatewayConnection, useSaveGateway } from "./hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  meta: ProviderMeta;
  existing?: PaymentGateway | null;
};

export function GatewayConfigDialog({ open, onOpenChange, meta, existing }: Props) {
  const save = useSaveGateway();
  const [values, setValues] = useState<Record<string, string>>({});
  const [env, setEnv] = useState<"sandbox" | "production">("sandbox");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (open) {
      const c = (existing?.credentials_encrypted ?? {}) as Record<string, any>;
      const init: Record<string, string> = {};
      meta.fields.forEach((f) => { init[f.key] = c[f.key] ?? ""; });
      setValues(init);
      setEnv((c.environment as any) ?? "sandbox");
    }
  }, [open, existing, meta]);

  const onSave = async () => {
    for (const f of meta.fields) {
      if (f.required && !values[f.key]?.trim()) {
        toast.error(`Preencha: ${f.label}`);
        return;
      }
    }
    try {
      await save.mutateAsync({
        id: existing?.id,
        provider: meta.provider,
        display_name: meta.name,
        credentials: values,
        environment: env,
      });
      toast.success(`${meta.name} conectado`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    }
  };

  const onTest = async () => {
    setTesting(true);
    try {
      const r = await testGatewayConnection(meta.provider, { ...values, environment: env });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar {meta.name}</DialogTitle>
          <DialogDescription>{meta.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {meta.fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              <Input
                type={f.type}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                autoComplete="off"
              />
            </div>
          ))}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Ambiente</Label>
              <p className="text-xs text-muted-foreground">{env === "sandbox" ? "Sandbox (testes)" : "Produção (real)"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sandbox</span>
              <Switch checked={env === "production"} onCheckedChange={(c) => setEnv(c ? "production" : "sandbox")} />
              <span className="text-xs text-muted-foreground">Produção</span>
            </div>
          </div>
          {meta.helpUrl && (
            <a href={meta.helpUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              Como obter as chaves <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar conexão"}
          </Button>
          <Button onClick={onSave} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

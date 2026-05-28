import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTriggerCatalog, type TriggerDef } from "@/hooks/useTriggerCatalog";
import { useFlowMutations, type Flow } from "@/hooks/useFlow";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = { open: boolean; onClose: () => void; flow: Flow };

export function TriggerPickerDialog({ open, onClose, flow }: Props) {
  const { data: triggers = [], isLoading } = useTriggerCatalog();
  const { update } = useFlowMutations();
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<TriggerDef | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});

  const categories = useMemo(() => {
    const map = new Map<string, { slug: string; name: string }>();
    for (const t of triggers) map.set(t.category_slug, { slug: t.category_slug, name: t.category });
    return Array.from(map.values());
  }, [triggers]);

  const triggersInCat = triggers.filter((t) => t.category_slug === category);

  const handleSave = async () => {
    if (!selected) return;
    try {
      await update.mutateAsync({
        id: flow.id,
        patch: { trigger_type: selected.slug, trigger_config: config },
      });
      toast.success("Gatilho salvo");
      onClose();
      setCategory(null); setSelected(null); setConfig({});
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  const schemaFields: Array<{ key: string; label: string; type: string }> = useMemo(() => {
    if (!selected?.config_schema?.properties) return [];
    return Object.entries(selected.config_schema.properties).map(([key, val]: [string, any]) => ({
      key,
      label: val.title ?? key,
      type: val.type ?? "string",
    }));
  }, [selected]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl h-[600px] p-0 flex flex-col">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>Selecionar gatilho</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-[180px] border-r bg-muted/30">
            <ScrollArea className="h-full">
              {isLoading ? (
                <div className="p-4 text-xs text-muted-foreground">Carregando...</div>
              ) : (
                categories.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => { setCategory(c.slug); setSelected(null); }}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm hover:bg-muted",
                      category === c.slug && "bg-muted font-medium",
                    )}
                  >
                    {c.name}
                  </button>
                ))
              )}
            </ScrollArea>
          </div>

          <div className="flex-1 p-3 overflow-y-auto">
            {!category ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Selecione uma categoria
              </div>
            ) : (
              <div className="space-y-2">
                {triggersInCat.map((t) => (
                  <button
                    key={t.slug}
                    onClick={() => { setSelected(t); setConfig(flow.trigger_type === t.slug ? flow.trigger_config ?? {} : {}); }}
                    className={cn(
                      "w-full text-left p-3 rounded-md border text-sm",
                      selected?.slug === t.slug ? "border-primary bg-primary/5" : "hover:bg-muted",
                    )}
                  >
                    <div className="font-medium">{t.display_name}</div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                    )}
                  </button>
                ))}
                {!triggersInCat.length && (
                  <div className="text-xs text-muted-foreground">Nenhum gatilho nesta categoria</div>
                )}
              </div>
            )}
          </div>

          <div className="w-[280px] border-l p-4 overflow-y-auto">
            {selected ? (
              <>
                <h4 className="font-semibold text-sm mb-1">{selected.display_name}</h4>
                <p className="text-xs text-muted-foreground mb-4">{selected.description}</p>
                <div className="space-y-3">
                  {schemaFields.map((f) => (
                    <div key={f.key}>
                      <Label className="text-xs">{f.label}</Label>
                      {f.type === "string" ? (
                        <Input
                          value={config[f.key] ?? ""}
                          onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                          className="h-8 text-sm"
                        />
                      ) : f.type === "object" || f.type === "array" ? (
                        <Textarea
                          value={JSON.stringify(config[f.key] ?? null, null, 2)}
                          onChange={(e) => {
                            try { setConfig({ ...config, [f.key]: JSON.parse(e.target.value) }); }
                            catch { /* ignore */ }
                          }}
                          rows={3}
                          className="text-xs font-mono"
                        />
                      ) : (
                        <Input
                          value={config[f.key] ?? ""}
                          onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
                          className="h-8 text-sm"
                        />
                      )}
                    </div>
                  ))}
                  {!schemaFields.length && (
                    <p className="text-xs text-muted-foreground">Este gatilho não requer configuração.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Selecione um gatilho</div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!selected}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

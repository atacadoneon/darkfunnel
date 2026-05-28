import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Upload, LayoutTemplate, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFlowMutations, useAutomationGroups } from "@/hooks/useFlow";
import { useFlowTemplates } from "@/hooks/useFlowTemplates";
import { toast } from "sonner";

type Props = { open: boolean; onClose: () => void };

type Mode = "blank" | "import" | "template";

export function CreateFlowDialog({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { create } = useFlowMutations();
  const { data: groups = [], create: createGroup } = useAutomationGroups();
  const { data: templates = [] } = useFlowTemplates();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState<string>("__none__");
  const [newGroupName, setNewGroupName] = useState("");
  const [mode, setMode] = useState<Mode>("blank");
  const [templateSlug, setTemplateSlug] = useState<string | null>(null);
  const [importText, setImportText] = useState("");

  const reset = () => {
    setName(""); setDescription(""); setGroupId("__none__"); setMode("blank");
    setTemplateSlug(null); setImportText(""); setNewGroupName("");
  };

  const handleConfirm = async () => {
    if (name.trim().length < 2) { toast.error("Nome muito curto"); return; }
    try {
      let finalGroupId: string | null = groupId === "__none__" ? null : groupId;
      if (groupId === "__new__" && newGroupName.trim()) {
        const g = await createGroup.mutateAsync(newGroupName.trim());
        finalGroupId = g.id;
      }

      let flow_json: any = undefined;
      if (mode === "template" && templateSlug) {
        const tpl = templates.find((t) => t.slug === templateSlug);
        flow_json = tpl?.flow_json;
      } else if (mode === "import" && importText.trim()) {
        try { flow_json = JSON.parse(importText); }
        catch { toast.error("JSON inválido"); return; }
      }

      const flow = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        group_id: finalGroupId,
        template_slug: templateSlug,
        flow_json,
      });
      toast.success("Automação criada");
      reset();
      onClose();
      navigate(`/automacoes/${flow.id}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar nova automação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boas-vindas" />
            </div>
            <div>
              <Label>Grupo</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem grupo</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                  <SelectItem value="__new__">+ Criar novo grupo</SelectItem>
                </SelectContent>
              </Select>
              {groupId === "__new__" && (
                <Input
                  className="mt-2"
                  placeholder="Nome do novo grupo"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              )}
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div>
            <Label className="mb-2 block">Como deseja começar?</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "blank" as Mode, icon: FileText, label: "Em branco" },
                { v: "import" as Mode, icon: Upload, label: "Importar JSON" },
                { v: "template" as Mode, icon: LayoutTemplate, label: "Modelo" },
              ].map((o) => {
                const Icon = o.icon;
                return (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setMode(o.v)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border text-sm transition-colors",
                      mode === o.v ? "border-primary bg-primary/5" : "hover:bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {mode === "import" && (
            <div>
              <Label>JSON</Label>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={6}
                placeholder='{"trigger": {...}, "nodes": [...], "edges": [...]}'
              />
            </div>
          )}

          {mode === "template" && (
            <div>
              <Label>Modelos disponíveis</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-64 overflow-y-auto">
                {templates.map((t) => (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => setTemplateSlug(t.slug)}
                    className={cn(
                      "text-left p-3 rounded-lg border text-sm",
                      templateSlug === t.slug ? "border-primary bg-primary/5" : "hover:bg-muted",
                    )}
                  >
                    <div className="font-medium">{t.name}</div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                    )}
                  </button>
                ))}
                {!templates.length && (
                  <div className="col-span-2 text-xs text-muted-foreground text-center py-6">
                    Nenhum modelo disponível
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={create.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

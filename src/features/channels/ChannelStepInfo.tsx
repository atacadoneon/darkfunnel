import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useSectors, useCreateSector } from "./configHooks";
import type { ChannelVisibility } from "./hooks";

export type Step1Value = {
  display_name: string;
  sector_id: string | null;
  visibility: ChannelVisibility;
  selected_user_ids: string[];
};

export function ChannelStepInfo({
  value,
  onChange,
}: {
  value: Step1Value;
  onChange: (v: Step1Value) => void;
}) {
  const { data: members = [] } = useWorkspaceMembers();
  const { data: sectors = [] } = useSectors();
  const createSector = useCreateSector();
  const [newSector, setNewSector] = useState("");
  const [creatingSector, setCreatingSector] = useState(false);

  const set = <K extends keyof Step1Value>(k: K, v: Step1Value[K]) => onChange({ ...value, [k]: v });

  const allUserIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const toggleUser = (id: string) => {
    const has = value.selected_user_ids.includes(id);
    set("selected_user_ids", has ? value.selected_user_ids.filter((x) => x !== id) : [...value.selected_user_ids, id]);
  };

  const handleCreateSector = async () => {
    if (!newSector.trim()) return;
    try {
      const s = await createSector.mutateAsync(newSector);
      set("sector_id", s.id);
      setNewSector("");
      setCreatingSector(false);
      toast.success("Setor criado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="dn">Nome do canal</Label>
        <Input
          id="dn"
          value={value.display_name}
          onChange={(e) => set("display_name", e.target.value)}
          placeholder="Atendimento Principal"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Setor</Label>
        {creatingSector ? (
          <div className="flex gap-2">
            <Input autoFocus value={newSector} onChange={(e) => setNewSector(e.target.value)} placeholder="Nome do setor" />
            <Button type="button" onClick={handleCreateSector} disabled={createSector.isPending || !newSector.trim()}>
              {createSector.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setCreatingSector(false); setNewSector(""); }}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Select value={value.sector_id ?? "none"} onValueChange={(v) => set("sector_id", v === "none" ? null : v)}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Sem setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem setor</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" onClick={() => setCreatingSector(true)} aria-label="Novo setor">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Quem pode ver os chats deste canal</Label>
        <RadioGroup value={value.visibility} onValueChange={(v) => set("visibility", v as ChannelVisibility)} className="space-y-2">
          <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary transition-colors">
            <RadioGroupItem value="all" className="mt-0.5" />
            <div>
              <div className="font-medium text-sm">Todos os usuários do workspace</div>
              <div className="text-xs text-muted-foreground">Qualquer pessoa da equipe pode ver e atender.</div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary transition-colors">
            <RadioGroupItem value="sector" className="mt-0.5" />
            <div>
              <div className="font-medium text-sm">Somente o setor selecionado</div>
              <div className="text-xs text-muted-foreground">Apenas membros do setor escolhido acima.</div>
            </div>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary transition-colors">
            <RadioGroupItem value="selected" className="mt-0.5" />
            <div>
              <div className="font-medium text-sm">Selecionar usuários</div>
              <div className="text-xs text-muted-foreground">Marque abaixo quem terá acesso.</div>
            </div>
          </label>
        </RadioGroup>

        {value.visibility === "selected" && (
          <div className="rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">{value.selected_user_ids.length} de {members.length} selecionados</span>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => set("selected_user_ids", value.selected_user_ids.length === allUserIds.length ? [] : allUserIds)}
              >
                {value.selected_user_ids.length === allUserIds.length ? "Limpar" : "Selecionar todos"}
              </button>
            </div>
            <ScrollArea className="max-h-48">
              <div className="p-2 space-y-1">
                {members.map((m) => (
                  <label key={m.user_id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                    <Checkbox checked={value.selected_user_ids.includes(m.user_id)} onCheckedChange={() => toggleUser(m.user_id)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{m.display_name ?? m.email ?? m.user_id.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    </div>
                  </label>
                ))}
                {members.length === 0 && <div className="text-xs text-muted-foreground p-2">Nenhum membro no workspace.</div>}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

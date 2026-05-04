import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, GripVertical, Loader2, Users, User as UserIcon, Info } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import {
  useSectors,
  useRotationSlots,
  addRotationSlot,
  updateRotationSlot,
  removeRotationSlot,
  type RotationSlot,
} from "./configHooks";
import { useQueryClient } from "@tanstack/react-query";

export function ChannelStepRotation({ channelId }: { channelId: string | null }) {
  const qc = useQueryClient();
  const { data: slots = [], isLoading } = useRotationSlots(channelId);
  const { data: members = [] } = useWorkspaceMembers();
  const { data: sectors = [] } = useSectors();
  const [picker, setPicker] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["rotation-slots", channelId] });

  const labelFor = (s: RotationSlot) => {
    if (s.target_type === "user") {
      const m = members.find((x) => x.user_id === s.user_id);
      return m?.display_name ?? m?.email ?? "Usuário";
    }
    const sec = sectors.find((x) => x.id === s.sector_id);
    return sec?.name ?? "Setor";
  };

  const handleAdd = async () => {
    if (!channelId || !picker) return;
    const [type, id] = picker.split(":");
    const position = (slots[slots.length - 1]?.position ?? 0) + 1;
    setAdding(true);
    try {
      await addRotationSlot(
        channelId,
        type === "user" ? { type: "user", user_id: id } : { type: "sector", sector_id: id },
        position,
      );
      setPicker("");
      invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (s: RotationSlot) => {
    try { await updateRotationSlot(s.id, { active: !s.active }); invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const toggleSkip = async (s: RotationSlot) => {
    try { await updateRotationSlot(s.id, { skip_when_offline: !s.skip_when_offline }); invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const remove = async (s: RotationSlot) => {
    try { await removeRotationSlot(s.id); invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  };

  if (!channelId) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Salve as informações do canal para configurar o rodízio.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground flex gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>Cadastre usuários ou setores na fila para que o sistema delegue novas conversas automaticamente. Se todos estiverem deslogados e a regra for "Pular", a conversa vai para o próximo da vez.</p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[40px_90px_1fr_180px_40px] gap-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground border-b">
          <span>#</span>
          <span>Status</span>
          <span>Usuário / Setor</span>
          <span>Se deslogado</span>
          <span></span>
        </div>

        {isLoading ? (
          <div className="p-6 text-center"><Loader2 className="h-4 w-4 animate-spin inline" /></div>
        ) : slots.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum item no rodízio ainda.</div>
        ) : (
          slots.map((s, idx) => (
            <div key={s.id} className="grid grid-cols-[40px_90px_1fr_180px_40px] gap-2 px-3 py-2.5 items-center border-b last:border-b-0">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <GripVertical className="h-3.5 w-3.5" />
                {idx + 1}º
              </div>
              <div>
                <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                {s.target_type === "sector"
                  ? <Users className="h-4 w-4 text-blue-500 shrink-0" />
                  : <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
                <span className="text-sm font-medium truncate">{labelFor(s)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch checked={s.skip_when_offline} onCheckedChange={() => toggleSkip(s)} />
                <span className="text-muted-foreground">{s.skip_when_offline ? "Pular" : "Não pular"}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(s)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <Select value={picker} onValueChange={setPicker}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Escolha um usuário ou setor..." />
          </SelectTrigger>
          <SelectContent>
            {sectors.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Setores</div>
                {sectors.map((s) => (
                  <SelectItem key={`sector:${s.id}`} value={`sector:${s.id}`}>👥 {s.name}</SelectItem>
                ))}
              </>
            )}
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Usuários</div>
            {members.map((m) => (
              <SelectItem key={`user:${m.user_id}`} value={`user:${m.user_id}`}>
                {m.display_name ?? m.email ?? m.user_id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleAdd} disabled={!picker || adding}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar ao rodízio"}
        </Button>
      </div>
    </div>
  );
}

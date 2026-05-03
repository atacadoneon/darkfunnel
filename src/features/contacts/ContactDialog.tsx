import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, MessageCircle, Instagram, Mail, Tag as TagIcon, X } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { useTags } from "@/features/inbox/filterHooks";
import {
  IDENTITY_LABELS,
  type Contact,
  type ContactIdentity,
  type IdentityKind,
} from "./hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact?: Contact | null;
};

type Draft = {
  key: string;
  id?: string;
  kind: IdentityKind;
  value: string;
  is_primary: boolean;
};

export const IDENTITY_ICON: Record<IdentityKind, React.ComponentType<{ className?: string }>> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  email: Mail,
};

const PLACEHOLDER: Record<IdentityKind, string> = {
  whatsapp: "+5511999999999",
  instagram: "@usuario",
  email: "lead@empresa.com",
};

export function ContactDialog({ open, onOpenChange, contact }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const editing = !!contact;

  const [name, setName] = useState("");
  const [pic, setPic] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [originalTagIds, setOriginalTagIds] = useState<string[]>([]);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const { data: allTags = [] } = useTags();

  useEffect(() => {
    if (!open) return;
    setName(contact?.display_name ?? "");
    setPic(contact?.profile_pic_url ?? "");
    const list = (contact?.identities ?? []).map<Draft>((i) => ({
      key: i.id,
      id: i.id,
      kind: i.kind,
      value: i.value,
      is_primary: i.is_primary,
    }));
    if (list.length === 0 && contact?.phone_e164) {
      list.push({
        key: "wa-fallback",
        kind: "whatsapp",
        value: contact.phone_e164,
        is_primary: true,
      });
    }
    setDrafts(list);
  }, [open, contact]);

  const original = useMemo(
    () => new Map((contact?.identities ?? []).map((i) => [i.id, i])),
    [contact]
  );

  const addRow = (kind: IdentityKind) => {
    setDrafts((d) => [
      ...d,
      {
        key: `new-${Math.random().toString(36).slice(2, 9)}`,
        kind,
        value: "",
        is_primary: d.length === 0,
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<Draft>) => {
    setDrafts((d) => d.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const removeRow = (key: string) => {
    setDrafts((d) => d.filter((r) => r.key !== key));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !contact) return;
    setSaving(true);
    try {
      // contato base
      const { error: cErr } = await supabase
        .from("contacts")
        .update({
          display_name: name.trim() || null,
          profile_pic_url: pic.trim() || null,
        })
        .eq("id", contact.id);
      if (cErr) throw cErr;

      const cleaned = drafts
        .map((d) => ({ ...d, value: d.value.trim() }))
        .filter((d) => d.value.length > 0);

      // diff vs original
      const keptIds = new Set(cleaned.filter((d) => d.id).map((d) => d.id!));
      const toDelete = (contact.identities ?? [])
        .filter((i) => !keptIds.has(i.id))
        .map((i) => i.id);

      if (toDelete.length) {
        const { error } = await supabase
          .from("contact_identities")
          .delete()
          .in("id", toDelete);
        if (error) throw error;
      }

      const toUpdate: { id: string; kind: IdentityKind; value: string; is_primary: boolean }[] = [];
      const toInsert: {
        workspace_id: string;
        contact_id: string;
        kind: IdentityKind;
        value: string;
        is_primary: boolean;
      }[] = [];

      for (const d of cleaned) {
        if (d.id) {
          const o = original.get(d.id);
          if (
            !o ||
            o.kind !== d.kind ||
            o.value !== d.value ||
            o.is_primary !== d.is_primary
          ) {
            toUpdate.push({ id: d.id, kind: d.kind, value: d.value, is_primary: d.is_primary });
          }
        } else {
          toInsert.push({
            workspace_id: current.id,
            contact_id: contact.id,
            kind: d.kind,
            value: d.value,
            is_primary: d.is_primary,
          });
        }
      }

      for (const u of toUpdate) {
        const { error } = await supabase
          .from("contact_identities")
          .update({ kind: u.kind, value: u.value, is_primary: u.is_primary })
          .eq("id", u.id);
        if (error) throw error;
      }
      if (toInsert.length) {
        const { error } = await supabase.from("contact_identities").insert(toInsert);
        if (error) throw error;
      }

      toast.success("Contato atualizado");
      qc.invalidateQueries({ queryKey: ["contacts", current.id] });
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar contato" : "Contato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Nome</Label>
            <Input
              id="cname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maria Silva"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cpic">Foto (URL)</Label>
            <Input
              id="cpic"
              value={pic}
              onChange={(e) => setPic(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Canais de contato</Label>
              <div className="flex items-center gap-1">
                {(["whatsapp", "instagram", "email"] as IdentityKind[]).map((k) => {
                  const Icon = IDENTITY_ICON[k];
                  return (
                    <Button
                      key={k}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => addRow(k)}
                    >
                      <Plus className="h-3 w-3" />
                      <Icon className="h-3 w-3" />
                      {IDENTITY_LABELS[k]}
                    </Button>
                  );
                })}
              </div>
            </div>

            {drafts.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Nenhum canal vinculado. Adicione WhatsApp, Instagram ou e-mail.
              </p>
            ) : (
              <ul className="space-y-2">
                {drafts.map((d) => {
                  const Icon = IDENTITY_ICON[d.kind];
                  return (
                    <li key={d.key} className="flex items-center gap-2">
                      <Select
                        value={d.kind}
                        onValueChange={(v) => updateRow(d.key, { kind: v as IdentityKind })}
                      >
                        <SelectTrigger className="h-9 w-[130px]">
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="instagram">Instagram</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        className="h-9 flex-1"
                        value={d.value}
                        onChange={(e) => updateRow(d.key, { value: e.target.value })}
                        placeholder={PLACEHOLDER[d.kind]}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant={d.is_primary ? "default" : "ghost"}
                        className="h-9 w-9 shrink-0"
                        title={d.is_primary ? "Principal" : "Definir como principal"}
                        onClick={() =>
                          setDrafts((arr) =>
                            arr.map((x) => ({ ...x, is_primary: x.key === d.key }))
                          )
                        }
                      >
                        <Badge
                          variant="outline"
                          className="border-0 bg-transparent p-0 text-[10px]"
                        >
                          ★
                        </Badge>
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRow(d.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// re-export for convenience
export type { ContactIdentity };

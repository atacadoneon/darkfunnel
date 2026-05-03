import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Contact } from "./hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact?: Contact | null;
};

export function ContactDialog({ open, onOpenChange, contact }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const editing = !!contact;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pic, setPic] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(contact?.display_name ?? "");
      setPhone(contact?.phone_e164 ?? "");
      setPic(contact?.profile_pic_url ?? "");
    }
  }, [open, contact]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setSaving(true);
    try {
      const payload = {
        workspace_id: current.id,
        display_name: name.trim() || null,
        phone_e164: phone.trim() || null,
        profile_pic_url: pic.trim() || null,
      };
      if (editing && contact) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", contact.id);
        if (error) throw error;
        toast.success("Contato atualizado");
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
        toast.success("Contato criado");
      }
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar contato" : "Novo contato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cname">Nome</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Silva" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cphone">Telefone (E.164)</Label>
            <Input id="cphone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5511999999999" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cpic">Foto (URL)</Label>
            <Input id="cpic" value={pic} onChange={(e) => setPic(e.target.value)} placeholder="https://…" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || (!name.trim() && !phone.trim())}>
              {saving ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

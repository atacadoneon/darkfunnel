import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Smartphone, BadgeCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ChannelKind, ChannelRow } from "./hooks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channel?: ChannelRow | null;
};

export function ChannelDialog({ open, onOpenChange, channel }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const editing = !!channel;

  const [step, setStep] = useState<"type" | "form">(editing ? "form" : "type");
  const [kind, setKind] = useState<ChannelKind>("uazapi");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [policy, setPolicy] = useState<ChannelRow["policy"]>("support");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(editing ? "form" : "type");
      setKind((channel?.kind ?? "uazapi") as ChannelKind);
      setDisplayName(channel?.display_name ?? "");
      setPhone(channel?.phone_e164 ?? "");
      setPolicy((channel?.policy ?? "support") as ChannelRow["policy"]);
    }
  }, [open, channel, editing]);

  const pickType = (k: ChannelKind) => {
    setKind(k);
    setStep("form");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current) return;
    setSaving(true);
    try {
      const payload = {
        workspace_id: current.id,
        kind,
        display_name: displayName.trim(),
        phone_e164: phone.trim() || null,
        policy,
      };
      if (editing && channel) {
        const { error } = await supabase.from("channels").update(payload).eq("id", channel.id);
        if (error) throw error;
        toast.success("Canal atualizado");
      } else {
        const { error } = await supabase.from("channels").insert(payload);
        if (error) throw error;
        toast.success("Canal criado");
      }
      qc.invalidateQueries({ queryKey: ["channels", current.id] });
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
        {step === "type" && !editing ? (
          <>
            <DialogHeader>
              <DialogTitle>Escolha o tipo de canal</DialogTitle>
              <DialogDescription>
                Selecione qual integração você deseja conectar ao seu workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <Card
                className="p-4 cursor-pointer hover:border-primary transition-colors flex items-start gap-3"
                onClick={() => pickType("uazapi")}
              >
                <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold">WhatsApp Business</div>
                  <p className="text-sm text-muted-foreground">
                    Conecte via QR Code (UAZAPI). Rápido e ideal para começar.
                  </p>
                </div>
              </Card>
              <Card
                className="p-4 cursor-pointer hover:border-primary transition-colors flex items-start gap-3"
                onClick={() => pickType("whatsapp_cloud")}
              >
                <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <BadgeCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold">WhatsApp API (WABA)</div>
                  <p className="text-sm text-muted-foreground">
                    Cloud API oficial da Meta. Suporta templates HSM e selo verificado.
                  </p>
                </div>
              </Card>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {!editing && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 -ml-1"
                    onClick={() => setStep("type")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                {editing ? "Editar canal" : kind === "uazapi" ? "Novo WhatsApp Business" : "Novo WhatsApp API (WABA)"}
              </DialogTitle>
              <DialogDescription>
                Cadastre o canal. As credenciais (token / API key) são adicionadas depois pela Edge Function de criptografia.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="dn">Nome de exibição</Label>
                <Input id="dn" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Atendimento Principal" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone (E.164)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+5551999999999" />
              </div>
              <div className="space-y-1.5">
                <Label>Política</Label>
                <Select value={policy} onValueChange={(v) => setPolicy(v as ChannelRow["policy"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Suporte</SelectItem>
                    <SelectItem value="sales">Vendas</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="transactional">Transacional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving || !displayName.trim()}>
                  {saving ? "Salvando..." : editing ? "Salvar" : "Criar canal"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

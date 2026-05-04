import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Loader2, User, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = { channelId: string | null; disabled?: boolean };

const PRIVACY_FIELDS: { key: string; label: string; options: { value: string; label: string }[] }[] = [
  { key: "lastseen", label: "Visto por último", options: [
    { value: "all", label: "Todos" }, { value: "contacts", label: "Contatos" },
    { value: "contact_blacklist", label: "Contatos exceto..." }, { value: "none", label: "Ninguém" },
  ]},
  { key: "profile", label: "Foto do perfil", options: [
    { value: "all", label: "Todos" }, { value: "contacts", label: "Contatos" },
    { value: "contact_blacklist", label: "Contatos exceto..." }, { value: "none", label: "Ninguém" },
  ]},
  { key: "status", label: "Recado", options: [
    { value: "all", label: "Todos" }, { value: "contacts", label: "Contatos" },
    { value: "contact_blacklist", label: "Contatos exceto..." }, { value: "none", label: "Ninguém" },
  ]},
  { key: "groupadd", label: "Grupos", options: [
    { value: "all", label: "Todos" }, { value: "contacts", label: "Contatos" },
    { value: "contact_blacklist", label: "Contatos exceto..." },
  ]},
  { key: "online", label: "Status", options: [
    { value: "all", label: "Todos" }, { value: "match_last_seen", label: "Como visto por último" },
  ]},
];

export function ChannelProfilePrivacy({ channelId, disabled }: Props) {
  const [profileOpen, setProfileOpen] = useState(true);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const [name, setName] = useState("");
  const [pic, setPic] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [savingPic, setSavingPic] = useState(false);

  const [privacy, setPrivacy] = useState<Record<string, string>>({});
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!channelId) throw new Error("canal não inicializado");
    const { data, error } = await supabase.functions.invoke("uazapi-instance", {
      body: { channel_id: channelId, action, ...extra },
    });
    if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Erro");
    return data;
  };

  const saveName = async () => {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    setSavingName(true);
    try { await invoke("set_profile_name", { profile_name: name.trim() }); toast.success("Nome do perfil atualizado"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSavingName(false); }
  };

  const savePic = async () => {
    if (!pic.trim()) { toast.error("Informe a URL da imagem"); return; }
    setSavingPic(true);
    try { await invoke("set_profile_picture", { profile_picture_url: pic.trim() }); toast.success("Foto atualizada"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSavingPic(false); }
  };

  const loadPrivacy = async () => {
    setLoadingPrivacy(true);
    try {
      const data = await invoke("get_privacy");
      const p = (data?.privacy ?? {}) as Record<string, string>;
      const next: Record<string, string> = {};
      for (const f of PRIVACY_FIELDS) next[f.key] = p[f.key] ?? "all";
      setPrivacy(next);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoadingPrivacy(false); }
  };

  const savePrivacy = async () => {
    setSavingPrivacy(true);
    try { await invoke("set_privacy", { privacy }); toast.success("Privacidade salva"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setSavingPrivacy(false); }
  };

  return (
    <div className="space-y-3">
      <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
        <div className="rounded-xl border">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 font-semibold text-sm"><User className="h-4 w-4" /> Perfil do WhatsApp</div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", profileOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do perfil</Label>
              <div className="flex gap-2">
                <Input placeholder="Nome exibido no WhatsApp" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} />
                <Button onClick={saveName} disabled={disabled || savingName}>
                  {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Foto do perfil</Label>
              <div className="flex gap-2">
                <Input placeholder="URL da imagem (https://...)" value={pic} onChange={(e) => setPic(e.target.value)} disabled={disabled} />
                <Button onClick={savePic} disabled={disabled || savingPic}>
                  {savingPic ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Collapsible open={privacyOpen} onOpenChange={(v) => { setPrivacyOpen(v); if (v && Object.keys(privacy).length === 0) void loadPrivacy(); }}>
        <div className="rounded-xl border">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 font-semibold text-sm"><Shield className="h-4 w-4" /> Privacidade</div>
            <ChevronDown className={cn("h-4 w-4 transition-transform", privacyOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-4 space-y-3">
            <Button variant="outline" className="w-full" onClick={loadPrivacy} disabled={disabled || loadingPrivacy}>
              {loadingPrivacy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Carregar configurações atuais
            </Button>
            <div className="space-y-2">
              {PRIVACY_FIELDS.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <Label className="text-sm">{f.label}</Label>
                  <Select value={privacy[f.key] ?? "all"} onValueChange={(v) => setPrivacy((p) => ({ ...p, [f.key]: v }))}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={savePrivacy} disabled={disabled || savingPrivacy}>
              {savingPrivacy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar Privacidade
            </Button>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

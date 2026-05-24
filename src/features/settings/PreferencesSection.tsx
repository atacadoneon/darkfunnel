import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User as UserIcon, Bell, Sliders, Shield, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";
import { useUserSettings } from "@/hooks/useUserSettings";
import { ADVANCE_OPTIONS, LANGUAGES, TIMEZONES } from "@/types/userSettings";
import { useTheme } from "@/components/theme/ThemeProvider";
import { toast } from "sonner";

export function PreferencesSection() {
  const { user } = useAuth();
  const { data: settings, update } = useUserSettings();
  const { theme, setTheme } = useTheme();

  const [profile, setProfile] = useState({ display_name: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setProfile({ display_name: data.display_name ?? "", phone: (data as any).phone ?? "" });
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: profile.display_name, phone: profile.phone })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado");
  };

  const [password, setPassword] = useState({ next: "", confirm: "" });
  const [savingPass, setSavingPass] = useState(false);
  const changePassword = async () => {
    if (password.next.length < 6) return toast.error("Senha deve ter pelo menos 6 caracteres");
    if (password.next !== password.confirm) return toast.error("Senhas não conferem");
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password: password.next });
    setSavingPass(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Senha alterada");
      setPassword({ next: "", confirm: "" });
    }
  };

  const initial = (profile.display_name || user?.email || "U").trim().charAt(0).toUpperCase();
  const s = settings;

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid grid-cols-4 max-w-xl">
        <TabsTrigger value="profile" className="gap-1.5"><UserIcon className="h-3.5 w-3.5" /> Perfil</TabsTrigger>
        <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-3.5 w-3.5" /> Notificações</TabsTrigger>
        <TabsTrigger value="preferences" className="gap-1.5"><Sliders className="h-3.5 w-3.5" /> Preferências</TabsTrigger>
        <TabsTrigger value="security" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Segurança</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-6">
        <Card className="p-6 space-y-5 max-w-xl">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl font-semibold">{initial}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{profile.display_name || user?.email}</div>
              <div className="text-xs text-muted-foreground">Avatar gerado automaticamente</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={profile.display_name} onChange={(e) => setProfile({ ...profile, display_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+55 11 99999-9999" />
          </div>
          <Button onClick={saveProfile} disabled={savingProfile} className="gap-1.5">
            <Save className="h-4 w-4" /> Salvar perfil
          </Button>
        </Card>
      </TabsContent>

      <TabsContent value="notifications" className="mt-6">
        <Card className="p-6 space-y-4 max-w-xl">
          {[
            { key: "notif_modal_auto" as const, label: "Modal automático", desc: "Abre modal de lembrete antes do evento" },
            { key: "notif_sound" as const, label: "Som", desc: "Toca som ao receber notificações" },
            { key: "notif_browser" as const, label: "Navegador", desc: "Notificações do sistema operacional" },
            { key: "notif_lead_new" as const, label: "Leads novos", desc: "Notifica quando um lead chega" },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 py-1">
              <div>
                <div className="text-sm font-medium">{row.label}</div>
                <div className="text-xs text-muted-foreground">{row.desc}</div>
              </div>
              <Switch
                checked={!!s?.[row.key]}
                onCheckedChange={(v) => update.mutate({ [row.key]: v } as any)}
              />
            </div>
          ))}
          <div className="border-t pt-4 space-y-1.5">
            <Label>Antecedência do lembrete</Label>
            <Select
              value={String(s?.notif_advance_minutes ?? 15)}
              onValueChange={(v) => update.mutate({ notif_advance_minutes: Number(v) })}
            >
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADVANCE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n} minutos antes</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="preferences" className="mt-6">
        <Card className="p-6 space-y-4 max-w-xl">
          <div className="space-y-1.5">
            <Label>Idioma</Label>
            <Select value={s?.language ?? "pt-BR"} onValueChange={(v) => update.mutate({ language: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fuso horário</Label>
            <Select value={s?.timezone ?? "America/Sao_Paulo"} onValueChange={(v) => update.mutate({ timezone: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tema</Label>
            <Select
              value={theme}
              onValueChange={(v) => {
                setTheme(v as any);
                update.mutate({ theme: v as any });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="security" className="mt-6">
        <Card className="p-6 space-y-4 max-w-xl">
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input type="password" value={password.next} onChange={(e) => setPassword({ ...password, next: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar senha</Label>
            <Input type="password" value={password.confirm} onChange={(e) => setPassword({ ...password, confirm: e.target.value })} />
          </div>
          <Button onClick={changePassword} disabled={savingPass}>Alterar senha</Button>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

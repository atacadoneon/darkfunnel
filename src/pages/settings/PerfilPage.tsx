import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Upload, LogOut, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useMyProfile, useUpdateMyProfile, useUpdatePassword } from "@/features/settings/settingsHooks";
import { useMyRole } from "@/features/workspace/permissions";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

export default function PerfilPage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyProfile();
  const { data: role } = useMyRole();
  const update = useUpdateMyProfile();
  const updatePwd = useUpdatePassword();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [clientName, setClientName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setClientName(profile.client_visible_name ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  const handleAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      await update.mutateAsync({ avatar_url: data.publicUrl });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = () => update.mutate({
    display_name: displayName.trim() || null,
    client_visible_name: clientName.trim() || null,
  });

  const logoutAll = async () => {
    await supabase.auth.signOut({ scope: "global" });
    toast.success("Sessões encerradas");
  };

  // Shell renders instantly; form fields populate as data arrives
  void isLoading;

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">Atualize seus dados pessoais e segurança da conta.</p>
      </header>

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xl font-semibold text-muted-foreground">
            {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" /> : (displayName || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="space-y-1">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAvatar(f); }} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Trocar foto
            </Button>
            <p className="text-xs text-muted-foreground">PNG ou JPG. Máx 2MB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Nome completo</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input value={profile?.email ?? user?.email ?? ""} readOnly disabled />
          </div>
          <div>
            <Label>Nome visível ao cliente</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Como o cliente verá você" />
          </div>
          <div>
            <Label>Função</Label>
            <div><Badge variant="outline" className="capitalize mt-1">{role ?? "—"}</Badge></div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={update.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar alterações"}
          </Button>
        </div>
      </Card>

      <Card className="p-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4" /> Senha</h3>
          <p className="text-sm text-muted-foreground">Altere sua senha de acesso.</p>
        </div>
        <Button variant="outline" onClick={() => setPwdOpen(true)}>Alterar senha</Button>
      </Card>

      <Card className="p-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><LogOut className="h-4 w-4" /> Sessão</h3>
          <p className="text-sm text-muted-foreground">Encerra a sessão em todos os dispositivos.</p>
        </div>
        <Button variant="outline" onClick={logoutAll}>Sair de todos os dispositivos</Button>
      </Card>

      <PasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} onSubmit={(p) => updatePwd.mutateAsync(p).then(() => setPwdOpen(false))} pending={updatePwd.isPending} />
    </div>
  );
}

function PasswordDialog({ open, onOpenChange, onSubmit, pending }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (pwd: string) => Promise<void>; pending: boolean }) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  useEffect(() => { if (!open) { setPwd(""); setConfirm(""); } }, [open]);
  const valid = pwd.length >= 8 && pwd === confirm;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar senha</DialogTitle>
          <DialogDescription>Mínimo de 8 caracteres.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Nova senha</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
          <div><Label>Confirmar senha</Label><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          {confirm && pwd !== confirm && <p className="text-xs text-destructive">As senhas não conferem.</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid || pending} onClick={() => onSubmit(pwd)} className="bg-violet-600 hover:bg-violet-700 text-white">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

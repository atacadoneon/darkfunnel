import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceDetails, useUpdateWorkspace, type WorkspaceDetails } from "@/features/settings/settingsHooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Bahia", "America/Fortaleza", "America/Recife", "America/Belem", "America/Rio_Branco", "UTC"];

export default function EmpresaPage() {
  const { data, isLoading } = useWorkspaceDetails();
  const update = useUpdateWorkspace();
  const canEdit = useIsManagerOrAdmin();
  const [form, setForm] = useState<Partial<WorkspaceDetails>>({});

  useEffect(() => { if (data) setForm(data); }, [data]);

  const set = <K extends keyof WorkspaceDetails>(k: K, v: WorkspaceDetails[K]) => setForm((p) => ({ ...p, [k]: v }));
  const save = () => update.mutate(form);
  const copyId = () => { if (data?.id) { navigator.clipboard.writeText(data.id); toast.success("ID copiado"); } };

  // Render shell instantly; inputs show empty placeholders until data arrives

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Empresa</h1>
        <p className="text-sm text-muted-foreground">Dados cadastrais da sua empresa.</p>
      </header>

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Nome da empresa</Label>
            <Input value={form.name ?? ""} disabled={!canEdit} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div><Label>Nicho</Label><Input value={form.niche ?? ""} disabled={!canEdit} onChange={(e) => set("niche", e.target.value)} /></div>
          <div><Label>E-mail comercial</Label><Input type="email" value={form.business_email ?? ""} disabled={!canEdit} onChange={(e) => set("business_email", e.target.value)} /></div>
          <div><Label>Telefone (E.164)</Label><Input value={form.business_phone_e164 ?? ""} disabled={!canEdit} placeholder="+5511999999999" onChange={(e) => set("business_phone_e164", e.target.value)} /></div>
          <div>
            <Label>Fuso horário</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.timezone ?? ""} disabled={!canEdit} onChange={(e) => set("timezone", e.target.value)}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><Label>Logo URL</Label><Input value={form.brand_logo_url ?? ""} disabled={!canEdit} onChange={(e) => set("brand_logo_url", e.target.value)} /></div>
        </div>

        <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2"><Label>Rua</Label><Input value={form.address_street ?? ""} disabled={!canEdit} onChange={(e) => set("address_street", e.target.value)} /></div>
          <div><Label>Número</Label><Input value={form.address_number ?? ""} disabled={!canEdit} onChange={(e) => set("address_number", e.target.value)} /></div>
          <div><Label>Cidade</Label><Input value={form.address_city ?? ""} disabled={!canEdit} onChange={(e) => set("address_city", e.target.value)} /></div>
          <div><Label>Estado</Label><Input value={form.address_state ?? ""} disabled={!canEdit} onChange={(e) => set("address_state", e.target.value)} /></div>
          <div><Label>CEP</Label><Input value={form.address_zip ?? ""} disabled={!canEdit} onChange={(e) => set("address_zip", e.target.value)} /></div>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={update.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4 flex items-center justify-between text-sm">
        <div>
          <p className="font-medium">Workspace ID</p>
          <p className="text-xs text-muted-foreground font-mono">{data?.id}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={copyId}><Copy className="h-4 w-4" /></Button>
      </Card>
    </div>
  );
}

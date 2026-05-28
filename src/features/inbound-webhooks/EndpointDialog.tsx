import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCreateInboundEndpoint, useTestMapping } from "@/hooks/useInboundEndpoints";
import { MappingEditor } from "./MappingEditor";
import { toast } from "sonner";

const SAMPLE_DEFAULT = JSON.stringify(
  { name: "Maria Silva", email: "maria@ex.com", phone: "+5511999999999", company: "ACME", interest: "Painel Neon" },
  null, 2,
);

export function EndpointDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateInboundEndpoint();
  const testMapping = useTestMapping();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createDeal, setCreateDeal] = useState(false);
  const [strategy, setStrategy] = useState("phone_email");
  const [sample, setSample] = useState(SAMPLE_DEFAULT);
  const [mapping, setMapping] = useState<{ fields: Record<string, string> }>({
    fields: { name: "$.name", email: "$.email", phone_e164: "$.phone" },
  });
  const [testResult, setTestResult] = useState<any>(null);

  const submit = async () => {
    if (!name.trim()) return toast.error("Informe o nome");
    try {
      const result: any = await create.mutateAsync({
        name: name.trim(),
        mapping,
        create_deal: createDeal,
        upsert_strategy: strategy,
      });
      const slug = result?.slug ?? result?.endpoint_slug;
      if (slug) {
        const url = `https://sbyslxhjjfcqlxaehidw.supabase.co/functions/v1/inbound-webhook/${slug}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        toast.success("Endpoint criado. URL copiada.");
      } else {
        toast.success("Endpoint criado.");
      }
      onClose();
      reset();
    } catch {}
  };

  const reset = () => {
    setName(""); setDescription(""); setCreateDeal(false); setStrategy("phone_email");
    setSample(SAMPLE_DEFAULT); setMapping({ fields: { name: "$.name", email: "$.email", phone_e164: "$.phone" } });
    setTestResult(null);
  };

  const runTest = async () => {
    try {
      const sampleJson = JSON.parse(sample);
      const r = await testMapping.mutateAsync({ mapping, sample: sampleJson });
      setTestResult(r);
    } catch (e: any) {
      toast.error("JSON inválido");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Novo endpoint de webhook</DialogTitle></DialogHeader>

        <Tabs defaultValue="basico">
          <TabsList>
            <TabsTrigger value="basico">Básico</TabsTrigger>
            <TabsTrigger value="mapeamento">Mapeamento</TabsTrigger>
            <TabsTrigger value="teste">Teste</TabsTrigger>
          </TabsList>

          <TabsContent value="basico" className="space-y-3 pt-3">
            <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div className="flex items-center justify-between">
              <Label>Criar Deal automaticamente</Label>
              <Switch checked={createDeal} onCheckedChange={setCreateDeal} />
            </div>
            <div>
              <Label>Estratégia de upsert</Label>
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone_email">Telefone + E-mail</SelectItem>
                  <SelectItem value="email_only">E-mail apenas</SelectItem>
                  <SelectItem value="phone_only">Telefone apenas</SelectItem>
                  <SelectItem value="external_id">External ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="mapeamento" className="pt-3">
            <MappingEditor sample={sample} setSample={setSample} mapping={mapping} setMapping={setMapping} />
          </TabsContent>

          <TabsContent value="teste" className="space-y-3 pt-3">
            <Label>Payload de teste</Label>
            <Textarea rows={8} className="font-mono text-xs" value={sample} onChange={(e) => setSample(e.target.value)} />
            <Button size="sm" onClick={runTest} disabled={testMapping.isPending}>
              {testMapping.isPending ? "Testando..." : "Testar mapeamento"}
            </Button>
            {testResult && (
              <pre className="text-xs bg-muted/40 rounded p-3 overflow-auto max-h-60 font-mono">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); reset(); }}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Criando..." : "Criar endpoint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { CompanyWizardShell, type StepDef } from "./CompanyWizardShell";

const STEPS: StepDef[] = [
  { id: 1, title: "Bem-vindo!" },
  { id: 2, title: "Como podemos falar com você?" },
  { id: 3, title: "Qual é o nicho da sua empresa?" },
  { id: 4, title: "Onde sua empresa está localizada?" },
];

const NICHES = [
  "E-commerce", "Infoproduto", "Comércio de Vendas", "Clínicas",
  "Escritório de Advogados", "Agências", "Outros",
];

export default function CompanyRegister() {
  const nav = useNavigate();
  const { current, refresh } = useWorkspace();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(current?.name ?? "");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [niche, setNiche] = useState("");
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const lookupCep = async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const d = await r.json();
      if (d?.erro) return;
      setStreet(d.logradouro ?? "");
      setNeighborhood(d.bairro ?? "");
      setCity(d.localidade ?? "");
      setState(d.uf ?? "");
    } catch {}
  };

  const next = () => {
    if (step === 1 && !name.trim()) return toast.error("Informe o nome da empresa");
    if (step === 2 && (!email.trim() || !phone.trim())) return toast.error("Preencha e-mail e telefone");
    if (step === 3 && !niche) return toast.error("Selecione um nicho");
    setStep((s) => Math.min(4, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    if (!current) return toast.error("Workspace não carregado");
    if (!zip || !street || !number || !neighborhood || !city || !state) {
      return toast.error("Preencha o endereço completo");
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("complete_company_onboarding" as any, {
        p_workspace_id: current.id,
        p_name: name.trim(),
        p_email: email.trim(),
        p_phone: phone.trim(),
        p_niche: niche,
        p_address: { country: "BR", zip, street, number, complement, neighborhood, city, state },
      });
      if (error) throw error;
      toast.success("Empresa cadastrada!");
      await refresh();
      nav("/company-register/preparing");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const stepMeta = STEPS[step - 1];
  const subtitle =
    step === 1 ? "Conte-nos como sua empresa se chamará."
      : step === 2 ? "Informe e-mail e telefone para contato."
      : step === 3 ? "Selecione um dos nichos abaixo."
      : "Informe o endereço completo para personalizar sua experiência.";

  return (
    <CompanyWizardShell
      sidebarTitle="Cadastre sua empresa"
      sidebarSubtitle="Vamos configurar sua conta em poucos passos."
      steps={STEPS}
      currentStep={step}
      stepTitle={stepMeta.title}
      stepSubtitle={subtitle}
      footer={
        <>
          {step > 1 && <Button variant="outline" onClick={back}>Voltar</Button>}
          {step < 4 ? (
            <Button onClick={next}>Próximo</Button>
          ) : (
            <Button onClick={submit} disabled={saving}>{saving ? "Criando..." : "Criar conta"}</Button>
          )}
        </>
      }
    >
      {step === 1 && (
        <div className="space-y-2">
          <Label>Nome da empresa</Label>
          <Input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Preencha com o nome da sua empresa"
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@suaempresa.com" />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 border rounded-md px-3 h-10 text-sm bg-muted/30">🇧🇷 +55</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {NICHES.map((n) => (
            <Card
              key={n}
              onClick={() => setNiche(n)}
              className={`p-4 cursor-pointer text-sm font-medium text-center transition-colors ${
                niche === n ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "hover:bg-muted/40"
              }`}
            >
              {n}
            </Card>
          ))}
        </div>
      )}

      {step === 4 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2">
            <Label>País</Label>
            <Input value="Brasil" disabled />
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              onBlur={(e) => lookupCep(e.target.value)}
              placeholder="00000-000"
            />
          </div>
          <div className="space-y-2">
            <Label>Estado (UF)</Label>
            <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Endereço</Label>
            <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua..." />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Complemento</Label>
            <Input value={complement} onChange={(e) => setComplement(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
        </div>
      )}
    </CompanyWizardShell>
  );
}

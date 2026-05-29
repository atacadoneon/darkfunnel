import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Users, Link as LinkIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { CompanyWizardShell, type StepDef } from "./CompanyWizardShell";

const PHASES: StepDef[] = [
  { id: 1, title: "Empresa" },
  { id: 2, title: "Plano" },
  { id: 3, title: "Setup" },
];

const NICHES = [
  "E-commerce", "Infoproduto", "Comércio de Vendas", "Clínicas",
  "Escritório de Advogados", "Agências", "Outros",
];

type Plan = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price_monthly_brl: number;
  price_annual_brl?: number | null;
  price_semester_brl?: number | null;
  features?: string[] | null;
  recommended?: boolean | null;
};

type SetupKey = "invited_member" | "connected_channel" | "finished";

const SETUP_ITEMS: { key: SetupKey; title: string; description: string; icon: any; href?: string }[] = [
  {
    key: "invited_member",
    title: "Convidar membros do time",
    description: "Adicione vendedores e gestores ao workspace.",
    icon: Users,
    href: "/settings?tab=users",
  },
  {
    key: "connected_channel",
    title: "Conectar um canal",
    description: "Conecte WhatsApp ou outro canal para receber conversas.",
    icon: LinkIcon,
    href: "/settings?tab=channels",
  },
];

export default function CompanyRegister() {
  const nav = useNavigate();
  const { current, refresh } = useWorkspace();
  const [phase, setPhase] = useState(1);
  const [saving, setSaving] = useState(false);

  // Phase 1
  const [name, setName] = useState(current?.name ?? "");
  const [niche, setNiche] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Phase 2
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<"annual" | "semester" | "monthly">("annual");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Phase 3
  const [done, setDone] = useState<Record<SetupKey, boolean>>({
    invited_member: false,
    connected_channel: false,
    finished: false,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subscription_plans" as any)
        .select("id,slug,name,description,price_monthly_brl,price_annual_brl,price_semester_brl,features,recommended")
        .order("price_monthly_brl");
      const list = ((data ?? []) as any[]) as Plan[];
      setPlans(list);
      const rec = list.find((p) => p.recommended) ?? list[1] ?? list[0];
      if (rec) setSelectedPlan(rec.slug);
    })();
  }, []);

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

  const callStep = async (payload: Record<string, any>) => {
    if (!current) throw new Error("workspace");
    const { error } = await supabase.rpc("complete_setup_step" as any, {
      p_workspace_id: current.id,
      ...payload,
    });
    if (error) throw error;
  };

  const validatePhase1 = () => {
    if (!name.trim()) return "Informe o nome da empresa";
    if (!niche) return "Selecione um nicho";
    if (!email.trim() || !phone.trim()) return "Preencha e-mail e telefone";
    if (!zip || !street || !number || !neighborhood || !city || !state) return "Preencha o endereço completo";
    return null;
  };

  const goNext = async () => {
    if (phase === 1) {
      const err = validatePhase1();
      if (err) return toast.error(err);
      setPhase(2);
      return;
    }
    if (phase === 2) {
      if (!selectedPlan) return toast.error("Selecione um plano");
      try {
        await callStep({ p_step: "chose_plan", p_plan_slug: selectedPlan, p_billing_cycle: cycle });
      } catch (e: any) {
        toast.error(e.message ?? "Falha ao salvar plano");
        return;
      }
      setPhase(3);
      return;
    }
  };

  const goBack = () => setPhase((p) => Math.max(1, p - 1));

  const markDone = async (key: SetupKey) => {
    try {
      await callStep({ p_step: key });
      setDone((d) => ({ ...d, [key]: true }));
    } catch (e: any) {
      // ainda marca local pra não travar
      setDone((d) => ({ ...d, [key]: true }));
    }
  };

  const finish = async () => {
    if (!current) return toast.error("Workspace não carregado");
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
      try { await callStep({ p_step: "finished" }); } catch {}
      await refresh();
      toast.success("Empresa configurada!");
      nav("/dashboard", { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao concluir");
    } finally {
      setSaving(false);
    }
  };

  const priceFor = (p: Plan) => {
    if (cycle === "annual") return p.price_annual_brl ?? p.price_monthly_brl;
    if (cycle === "semester") return p.price_semester_brl ?? p.price_monthly_brl;
    return p.price_monthly_brl;
  };

  const phaseMeta = PHASES[phase - 1];
  const subtitle =
    phase === 1 ? "Conte sobre sua empresa, nicho e onde está localizada."
      : phase === 2 ? "Escolha o plano ideal para sua operação."
      : "Conclua as últimas configurações para começar a usar.";

  return (
    <CompanyWizardShell
      sidebarTitle="Cadastre sua empresa"
      sidebarSubtitle="3 fases rápidas para configurar sua conta."
      steps={PHASES}
      currentStep={phase}
      stepTitle={phaseMeta.title}
      stepSubtitle={subtitle}
      footer={
        <>
          {phase > 1 && <Button variant="outline" onClick={goBack}>Voltar</Button>}
          {phase < 3 ? (
            <Button onClick={goNext}>Próximo</Button>
          ) : (
            <Button onClick={finish} disabled={saving}>
              {saving ? "Concluindo..." : "Concluir"}
            </Button>
          )}
        </>
      }
    >
      {phase === 1 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Nome da empresa</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da sua empresa" />
          </div>

          <div className="space-y-2">
            <Label>Nicho</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NICHES.map((n) => (
                <Card
                  key={n}
                  onClick={() => setNiche(n)}
                  className={`p-3 cursor-pointer text-xs font-medium text-center transition-colors ${
                    niche === n ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  {n}
                </Card>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Localização</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input value={zip} onChange={(e) => setZip(e.target.value)} onBlur={(e) => lookupCep(e.target.value)} placeholder="00000-000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">UF</Label>
                <Input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Endereço</Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Número</Label>
                <Input value={number} onChange={(e) => setNumber(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Complemento</Label>
                <Input value={complement} onChange={(e) => setComplement(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {phase === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <div className="inline-flex rounded-md border p-1 text-xs">
              {(["annual", "semester", "monthly"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={`px-3 py-1.5 rounded ${cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {c === "annual" ? "Anual" : c === "semester" ? "Semestral" : "Mensal"}
                </button>
              ))}
            </div>
          </div>

          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando planos...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {plans.map((p) => {
                const isSel = selectedPlan === p.slug;
                const features = Array.isArray(p.features) ? p.features : [];
                return (
                  <Card
                    key={p.id}
                    onClick={() => setSelectedPlan(p.slug)}
                    className={`p-4 cursor-pointer transition-colors flex flex-col ${
                      isSel ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{p.name}</h3>
                      {p.recommended && <Badge variant="default" className="text-[10px]">Recomendado</Badge>}
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                    <div className="mt-3">
                      <span className="text-2xl font-bold">
                        R$ {Number(priceFor(p)).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        /{cycle === "annual" ? "ano" : cycle === "semester" ? "semestre" : "mês"}
                      </span>
                    </div>
                    {features.length > 0 && (
                      <ul className="mt-3 space-y-1 flex-1">
                        {features.slice(0, 6).map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs">
                            <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" /> <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button
                      type="button"
                      variant={isSel ? "default" : "outline"}
                      size="sm"
                      className="mt-4 w-full"
                      onClick={(e) => { e.stopPropagation(); setSelectedPlan(p.slug); }}
                    >
                      {isSel ? "Selecionado" : "Selecionar"}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {phase === 3 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Marque cada passo conforme concluir. Você pode fazer isso depois também.</span>
          </div>
          {SETUP_ITEMS.map((item) => {
            const Icon = item.icon;
            const isDone = done[item.key];
            return (
              <Card key={item.key} className={`p-4 flex items-center gap-3 ${isDone ? "bg-primary/5 border-primary/40" : ""}`}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isDone ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <div className="flex items-center gap-1">
                  {item.href && (
                    <Button variant="outline" size="sm" onClick={() => window.open(item.href!, "_blank")}>
                      Abrir
                    </Button>
                  )}
                  <Button
                    variant={isDone ? "ghost" : "default"}
                    size="sm"
                    onClick={() => markDone(item.key)}
                    disabled={isDone}
                  >
                    {isDone ? "Feito" : "Concluir"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </CompanyWizardShell>
  );
}

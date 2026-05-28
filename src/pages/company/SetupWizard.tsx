import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Link as LinkIcon, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { CompanyWizardShell, type StepDef } from "./CompanyWizardShell";

const STEPS: StepDef[] = [
  { id: 1, title: "Convidar membros" },
  { id: 2, title: "Conectar canal" },
  { id: 3, title: "Selecione seu plano" },
];

type Plan = {
  id: string; slug: string; name: string; recommended?: boolean;
  price_monthly_brl: number; price_annual_brl?: number | null; price_semester_brl?: number | null;
};

export default function SetupWizard() {
  const nav = useNavigate();
  const { current, refresh } = useWorkspace();
  const [step, setStep] = useState(1);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currency] = useState("BRL");
  const [cycle, setCycle] = useState<"annual" | "semester" | "monthly">("annual");
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subscription_plans" as any)
        .select("id,slug,name,price_monthly_brl,price_annual_brl,price_semester_brl,recommended")
        .order("price_monthly_brl");
      const list = ((data ?? []) as any[]) as Plan[];
      setPlans(list);
      const recommended = list.find((p) => p.recommended) ?? list[1] ?? list[0];
      if (recommended) setSelected(recommended.slug);
    })();
  }, []);

  const callStep = async (payload: Record<string, any>) => {
    if (!current) throw new Error("workspace");
    const { error } = await supabase.rpc("complete_setup_step" as any, {
      p_workspace_id: current.id,
      ...payload,
    });
    if (error) throw error;
  };

  const skipOrNext = async (stepKey: string) => {
    try { await callStep({ p_step: stepKey }); } catch {}
    setStep((s) => Math.min(3, s + 1));
  };

  const finish = async () => {
    if (!selected) return toast.error("Selecione um plano");
    setSaving(true);
    try {
      await callStep({ p_step: "chose_plan", p_plan_slug: selected, p_billing_cycle: cycle });
      await callStep({ p_step: "finished" });
      await refresh();
      toast.success("Conta configurada!");
      nav("/dashboard", { replace: true });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao finalizar");
    } finally {
      setSaving(false);
    }
  };

  const priceFor = (p: Plan) => {
    if (cycle === "annual") return p.price_annual_brl ?? p.price_monthly_brl;
    if (cycle === "semester") return p.price_semester_brl ?? p.price_monthly_brl;
    return p.price_monthly_brl;
  };

  const stepMeta = STEPS[step - 1];
  const subtitle =
    step === 1 ? "Convide membros do seu time para colaborar."
      : step === 2 ? "Conecte WhatsApp ou outro canal para receber mensagens."
      : "Escolha o plano ideal para sua operação.";

  return (
    <CompanyWizardShell
      sidebarTitle="Complete sua configuração"
      sidebarSubtitle="Mais 3 passos rápidos para começar."
      steps={STEPS}
      currentStep={step}
      stepTitle={stepMeta.title}
      stepSubtitle={subtitle}
      footer={
        <>
          {step > 1 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Voltar</Button>}
          {step < 3 ? (
            <>
              <Button variant="ghost" onClick={() => skipOrNext(step === 1 ? "invited_member" : "connected_channel")}>
                Pular por enquanto
              </Button>
              <Button onClick={() => skipOrNext(step === 1 ? "invited_member" : "connected_channel")}>Próximo</Button>
            </>
          ) : (
            <Button onClick={finish} disabled={saving}>{saving ? "Concluindo..." : "Concluir"}</Button>
          )}
        </>
      }
    >
      {step === 1 && (
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Adicione vendedores e gestores ao seu workspace para começar a colaborar.
          </p>
          <Button variant="outline" onClick={() => nav("/settings?tab=users")}>Convidar usuário</Button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <LinkIcon className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground max-w-sm">
            Conecte WhatsApp, Instagram ou outro canal para começar a receber conversas.
          </p>
          <Button variant="outline" onClick={() => nav("/settings?tab=channels")}>Criar conexão</Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Select value={currency} onValueChange={() => {}}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="BRL">BRL (R$)</SelectItem></SelectContent>
            </Select>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {plans.map((p) => {
              const isSel = selected === p.slug;
              return (
                <Card
                  key={p.id}
                  onClick={() => setSelected(p.slug)}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSel ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.recommended && <Badge>Recomendado</Badge>}
                  </div>
                  <div className="mt-2 text-2xl font-bold">
                    R$ {Number(priceFor(p)).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                    <span className="text-xs font-normal text-muted-foreground">/mês</span>
                  </div>
                  {isSel && (
                    <div className="mt-2 text-xs text-primary inline-flex items-center gap-1">
                      <Check className="h-3 w-3" /> Selecionado
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </CompanyWizardShell>
  );
}

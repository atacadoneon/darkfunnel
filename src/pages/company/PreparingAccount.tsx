import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const STATUSES = [
  "Criando fluxos de automação...",
  "Configurando seu pipeline padrão...",
  "Conectando integrações...",
  "Aplicando templates de mensagem...",
  "Quase lá...",
];

export default function PreparingAccount() {
  const nav = useNavigate();
  const [pct, setPct] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPct((p) => Math.min(100, p + 4)), 240);
    const s = setInterval(() => setStatusIdx((i) => (i + 1) % STATUSES.length), 1300);
    return () => { clearInterval(t); clearInterval(s); };
  }, []);

  useEffect(() => {
    if (pct >= 100) {
      const to = setTimeout(() => nav("/company-register/setup", { replace: true }), 500);
      return () => clearTimeout(to);
    }
  }, [pct, nav]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-6">
      <Card className="w-full max-w-md p-8 space-y-6 text-center">
        <h1 className="text-2xl font-bold">Estamos preparando sua conta</h1>
        <p className="text-sm text-muted-foreground min-h-[1.25rem]">{STATUSES[statusIdx]}</p>
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground">
          Isso pode levar alguns segundos. Você pode deixar esta aba aberta.
        </p>
      </Card>
    </div>
  );
}

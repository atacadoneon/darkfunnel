import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Phone, PhoneOff, Pause, Square, Loader2, Copy, CheckCircle2, Sparkles,
  AlertTriangle, Target as TargetIcon, MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useStages } from "@/features/pipeline/hooks";
import { useMessages } from "@/features/inbox/hooks";
import { MessageThread } from "@/features/inbox/MessageThread";
import {
  useCampaign, useQueue, useSetCampaignStatus, useSetOutcome, useAiCoach, fetchNextLead,
  sendNoAnswerMessage,
  type DialerQueueItem, type QueueOutcome, type AiCoach,
} from "@/features/dialer/hooks";
import { CallTimer } from "@/components/voice/CallTimer";
import { cn } from "@/lib/utils";

type RunState = "idle" | "calling" | "outcome";

function brl(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SentimentBadge({ s }: { s?: string }) {
  if (!s) return null;
  const map: Record<string, { c: string; t: string }> = {
    positivo: { c: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30", t: "🟢 Sentimento positivo" },
    neutro: { c: "bg-amber-500/15 text-amber-700 border-amber-500/30", t: "🟡 Sentimento neutro" },
    negativo: { c: "bg-red-500/15 text-red-700 border-red-500/30", t: "🔴 Sentimento negativo" },
  };
  const m = map[s] ?? map.neutro;
  return <Badge className={`${m.c} border`}>{m.t}</Badge>;
}

export default function DialerRun() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { current: ws } = useWorkspace();
  const { data: campaign } = useCampaign(id ?? null);
  const { data: queue = [] } = useQueue(id ?? null);
  const { data: stages = [] } = useStages();
  const setStatus = useSetCampaignStatus();
  const aiCoach = useAiCoach();

  const [currentItem, setCurrentItem] = useState<DialerQueueItem | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<string | null>(null);
  const [coach, setCoach] = useState<AiCoach | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);

  const { data: messages = [] } = useMessages(currentItem?.conversation_id ?? null);

  /* --------- Boot: set campaign active + load first lead --------- */
  const loadNext = useCallback(async () => {
    if (!id) return;
    setCoach(null);
    setCurrentItem(null);
    try {
      const next = await fetchNextLead(id);
      if (!next) {
        toast.success("Fila concluída!");
        await setStatus.mutateAsync({ id, status: "completed" });
        return;
      }
      setCurrentItem(next);
      setRunState("idle");
      // Fire AI coach
      if (next.id) {
        setCoachLoading(true);
        aiCoach.mutate(
          { contact_id: next.contact_id, deal_id: next.deal_id, queue_id: next.id },
          {
            onSuccess: (data) => { setCoach(data); setCoachLoading(false); },
            onError: (e: any) => { toast.error(e?.message ?? "Erro IA"); setCoachLoading(false); },
          },
        );
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao buscar próximo lead");
    }
  }, [id]); // eslint-disable-line

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        if (campaign && (campaign.status === "draft" || campaign.status === "paused")) {
          await setStatus.mutateAsync({ id, status: "active" });
        }
      } catch { /* ignore */ }
      if (!currentItem) void loadNext();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, campaign?.status]);

  /* --------- Subscribe to call status updates --------- */
  useEffect(() => {
    if (!activeCallId) return;
    const ch = supabase
      .channel(`call:${activeCallId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${activeCallId}` },
        (p: any) => {
          const st = p?.new?.status;
          if (st === "in_progress" && p?.new?.answered_at) setCallStartedAt(p.new.answered_at);
          if (st === "completed" || st === "failed" || st === "no-answer" || st === "busy") {
            setRunState("outcome");
            setOutcomeOpen(true);
          }
        })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [activeCallId]);

  /* --------- Actions --------- */
  const startCall = useCallback(async () => {
    if (!ws || !currentItem) return;
    const rawTo = currentItem.phone_e164 ?? currentItem.contact?.phone_e164;
    if (!rawTo) { toast.error("Sem telefone para este lead"); return; }
    const to = (await import("@/lib/phone")).toZenviaBR(rawTo);
    if (!/^\d{10,11}$/.test(to)) { toast.error("Telefone inválido (use DDD + número)"); return; }
    try {
      const { data, error } = await supabase.functions.invoke("voice-outbound", {
        body: {
          workspace_id: ws.id,
          to,
          contact_id: currentItem.contact_id,
          deal_id: currentItem.deal_id,
          channel: "pstn",
        },
      });
      if (error) throw error;
      setActiveCallId((data as any)?.call_id ?? null);
      setCallStartedAt(new Date().toISOString());
      setRunState("calling");
      toast.success(`Chamando ${currentItem.contact?.display_name ?? to}...`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao ligar");
    }
  }, [ws, currentItem]);

  const endCall = useCallback(async () => {
    if (activeCallId) {
      try { await (supabase as any).from("calls").update({ status: "completed" }).eq("id", activeCallId); } catch {}
    }
    setRunState("outcome");
    setOutcomeOpen(true);
  }, [activeCallId]);

  const pauseCampaign = useCallback(async () => {
    if (!id) return;
    await setStatus.mutateAsync({ id, status: "paused" });
    toast.success("Campanha pausada");
    navigate("/discador");
  }, [id, setStatus, navigate]);

  const endCampaign = useCallback(async () => {
    if (!id) return;
    if (!confirm("Encerrar campanha? Isso marcará como concluída.")) return;
    await setStatus.mutateAsync({ id, status: "completed" });
    navigate("/discador");
  }, [id, setStatus, navigate]);

  /* --------- Keyboard shortcuts --------- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.key === "l" && runState === "idle") { e.preventDefault(); void startCall(); }
      if (e.key === "x" && runState === "calling") { e.preventDefault(); void endCall(); }
      if (e.key === "n") { e.preventDefault(); void loadNext(); }
      if (e.key === "p") { e.preventDefault(); void pauseCampaign(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [runState, startCall, endCall, loadNext, pauseCampaign]);

  const stage = stages.find((s) => s.id === currentItem?.deal?.stage_id);
  const stageName = stage?.name ?? (currentItem as any)?.stage_name ?? null;
  const stageColor = stage?.color ?? "hsl(var(--primary))";
  const stageObjective = (stage as any)?.default_objective ?? (currentItem as any)?.default_objective;

  const target = campaign?.target_count ?? 0;
  const done = campaign?.completed_count ?? 0;
  const pct = target > 0 ? Math.round((done / target) * 100) : 0;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-2 flex items-center gap-3 bg-card/50">
        <Button size="icon" variant="ghost" onClick={() => navigate("/discador")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{campaign?.name ?? "Carregando..."}</div>
          <div className="text-xs text-muted-foreground">Discador automático em operação</div>
        </div>
        <div className="text-xs text-muted-foreground hidden md:flex gap-3">
          <kbd className="px-1.5 py-0.5 border rounded">L</kbd> Ligar
          <kbd className="px-1.5 py-0.5 border rounded">X</kbd> Encerrar
          <kbd className="px-1.5 py-0.5 border rounded">N</kbd> Próximo
          <kbd className="px-1.5 py-0.5 border rounded">P</kbd> Pausar
        </div>
      </div>

      <div className="flex-1 grid grid-cols-[280px_1fr_380px] overflow-hidden">
        {/* ============ LEFT: QUEUE ============ */}
        <div className="border-r flex flex-col bg-muted/20">
          <div className="p-3 border-b space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase">Fila</div>
            <div className="flex justify-between text-xs">
              <span className="tabular-nums font-medium">{done} / {target}</span>
              <span className="text-muted-foreground">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {queue.map((q) => {
              const isCurrent = q.id === currentItem?.id;
              const isDone = q.status === "completed";
              return (
                <button
                  key={q.id}
                  onClick={() => !isDone && setCurrentItem(q)}
                  disabled={isDone}
                  className={cn(
                    "w-full text-left p-2 rounded-md border text-xs flex items-center gap-2 transition-colors",
                    isCurrent && "bg-primary/10 border-primary",
                    !isCurrent && !isDone && "hover:bg-muted/60",
                    isDone && "opacity-50 line-through",
                  )}
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={q.contact?.profile_pic_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">{(q.contact?.display_name ?? "?").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{q.contact?.display_name ?? q.phone_e164 ?? "Sem nome"}</div>
                    {q.deal && <div className="text-[10px] text-muted-foreground truncate">{q.deal.title}</div>}
                  </div>
                  {isDone && q.outcome && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{q.outcome}</Badge>
                  )}
                </button>
              );
            })}
            {queue.length === 0 && (
              <div className="text-xs text-muted-foreground italic text-center py-6">Fila vazia.</div>
            )}
          </div>
          <div className="p-2 border-t space-y-1">
            <Button variant="outline" size="sm" className="w-full gap-1" onClick={pauseCampaign}>
              <Pause className="h-3.5 w-3.5" /> Pausar campanha
            </Button>
            <Button variant="outline" size="sm" className="w-full gap-1 text-destructive" onClick={endCampaign}>
              <Square className="h-3.5 w-3.5" /> Encerrar campanha
            </Button>
          </div>
        </div>

        {/* ============ CENTER: CONVERSATION ============ */}
        <div className="flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden bg-[hsl(var(--background))]">
            {currentItem?.conversation_id ? (
              <MessageThread messages={messages as any} contactAvatar={currentItem.contact?.profile_pic_url ?? null} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                {currentItem ? "Sem conversa para este lead." : "Carregando..."}
              </div>
            )}
          </div>

          {/* Call action bar */}
          <div className="border-t p-3 bg-card">
            {runState === "idle" && currentItem && (
              <Button onClick={startCall} size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-14 text-base">
                <Phone className="h-5 w-5" /> LIGAR AGORA
              </Button>
            )}
            {runState === "calling" && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-medium">Em chamada</span>
                  <CallTimer startedAt={callStartedAt} className="text-sm font-mono" />
                </div>
                <Button onClick={endCall} variant="destructive" size="lg" className="flex-1 gap-2">
                  <PhoneOff className="h-4 w-4" /> Encerrar chamada
                </Button>
              </div>
            )}
            {runState === "outcome" && (
              <Button onClick={() => setOutcomeOpen(true)} size="lg" className="w-full gap-2">
                Registrar resultado
              </Button>
            )}
            {!currentItem && (
              <Button onClick={loadNext} variant="outline" className="w-full">Carregar próximo lead</Button>
            )}
          </div>
        </div>

        {/* ============ RIGHT: LEAD + AI COACH ============ */}
        <div className="border-l flex flex-col overflow-hidden bg-card/30">
          <div className="p-3 border-b">
            {currentItem ? (
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={currentItem.contact?.profile_pic_url ?? undefined} />
                  <AvatarFallback>{(currentItem.contact?.display_name ?? "?").charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{currentItem.contact?.display_name ?? "Sem nome"}</div>
                  <div className="text-xs text-muted-foreground">{currentItem.phone_e164 ?? currentItem.contact?.phone_e164 ?? "—"}</div>
                  {currentItem.deal && (
                    <div className="text-xs mt-1">
                      <span className="font-medium">{currentItem.deal.title}</span>
                      <span className="text-emerald-600 ml-2">{brl(currentItem.deal.value_cents)}</span>
                    </div>
                  )}
                  {stage && (
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: stage.color, color: stage.color }}>
                        {stage.name}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem lead carregado</div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" /> AI COACH
            </div>

            {coachLoading && (
              <Card className="p-4 flex flex-col items-center gap-2 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div className="text-xs text-muted-foreground">IA analisando conversa...</div>
              </Card>
            )}

            {!coachLoading && coach && (
              <div className="space-y-3 text-xs">
                {(stageObjective || coach.objetivo) && (
                  <div>
                    <div className="font-semibold text-muted-foreground flex items-center gap-1">
                      <TargetIcon className="h-3 w-3" /> OBJETIVO DA ETAPA
                    </div>
                    <div className="text-muted-foreground mt-0.5">{coach.objetivo ?? stageObjective}</div>
                  </div>
                )}

                {coach.resumo && coach.resumo.length > 0 && (
                  <div>
                    <div className="font-semibold">📋 RESUMO</div>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      {coach.resumo.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}

                {coach.abertura && (
                  <div>
                    <div className="font-semibold">💬 ABERTURA SUGERIDA</div>
                    <div className="mt-1 p-2 rounded bg-sky-500/10 border border-sky-500/30 relative pr-7">
                      {coach.abertura}
                      <button
                        onClick={() => { navigator.clipboard.writeText(coach.abertura!); toast.success("Copiado"); }}
                        className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}

                {coach.perguntas && coach.perguntas.length > 0 && (
                  <div>
                    <div className="font-semibold">❓ PERGUNTAS ESTRATÉGICAS</div>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      {coach.perguntas.slice(0, 2).map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}

                {coach.objecao && (
                  <div>
                    <div className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-amber-500" /> POSSÍVEL OBJEÇÃO</div>
                    {typeof coach.objecao === "string" ? (
                      <div className="mt-0.5">{coach.objecao}</div>
                    ) : (
                      <div className="mt-0.5 space-y-1">
                        {coach.objecao.texto && <div>{coach.objecao.texto}</div>}
                        {coach.objecao.resposta && (
                          <div className="text-muted-foreground italic">→ {coach.objecao.resposta}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {coach.proximo_passo && (
                  <div>
                    <div className="font-semibold">➡️ PRÓXIMO PASSO</div>
                    <div className="font-bold mt-0.5">{coach.proximo_passo}</div>
                  </div>
                )}

                {coach.sentimento && (
                  <div className="pt-1">
                    <SentimentBadge s={coach.sentimento} />
                  </div>
                )}
              </div>
            )}

            {!coachLoading && !coach && currentItem && (
              <Card className="p-3 text-xs text-muted-foreground">
                Coach IA indisponível para este lead.
              </Card>
            )}
          </div>
        </div>
      </div>

      <OutcomeModal
        open={outcomeOpen}
        onOpenChange={setOutcomeOpen}
        queueId={currentItem?.id ?? null}
        callId={activeCallId}
        defaultAutoMsg={!!campaign?.auto_send_no_answer_msg}
        onDone={async () => {
          setOutcomeOpen(false);
          setActiveCallId(null);
          setCallStartedAt(null);
          await loadNext();
        }}
      />
    </div>
  );
}

/* ====================== Outcome Modal ====================== */
function OutcomeModal({
  open, onOpenChange, queueId, callId, defaultAutoMsg, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  queueId: string | null;
  callId: string | null;
  defaultAutoMsg: boolean;
  onDone: () => void;
}) {
  const setOutcomeM = useSetOutcome();
  const [outcome, setOutcome] = useState<QueueOutcome>(null);
  const [notes, setNotes] = useState("");
  const [sendAuto, setSendAuto] = useState(defaultAutoMsg);
  const [reagendarAt, setReagendarAt] = useState("");

  useEffect(() => {
    if (open) { setOutcome(null); setNotes(""); setSendAuto(defaultAutoMsg); setReagendarAt(""); }
  }, [open, defaultAutoMsg]);

  // Keyboard shortcuts inside modal
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "1") setOutcome("atendeu");
      if (e.key === "2") setOutcome("nao_atendeu");
      if (e.key === "3") setOutcome("reagendar");
      if (e.key === "4") setOutcome("convertido");
      if (e.key === "5") setOutcome("sem_interesse");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open]);

  const save = async () => {
    if (!queueId || !outcome) { toast.error("Selecione o resultado"); return; }
    try {
      const fullNotes = outcome === "reagendar" && reagendarAt
        ? `[Reagendar: ${reagendarAt}] ${notes}`.trim()
        : notes;
      await setOutcomeM.mutateAsync({ queue_id: queueId, outcome, notes: fullNotes, call_id: callId });
      if (outcome === "nao_atendeu" && sendAuto) {
        try { await sendNoAnswerMessage(queueId); toast.success("Mensagem WhatsApp enviada"); }
        catch (e: any) { toast.error("Falha msg automática: " + (e?.message ?? "")); }
      }
      toast.success("Resultado registrado");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  };

  const options: { v: QueueOutcome; label: string; cls: string; key: string }[] = [
    { v: "atendeu", label: "Atendeu", cls: "bg-emerald-500/15 border-emerald-500 text-emerald-700 hover:bg-emerald-500/25", key: "1" },
    { v: "nao_atendeu", label: "Não atendeu", cls: "bg-slate-500/15 border-slate-400 text-slate-700 hover:bg-slate-500/25", key: "2" },
    { v: "reagendar", label: "Reagendar", cls: "bg-amber-500/15 border-amber-500 text-amber-700 hover:bg-amber-500/25", key: "3" },
    { v: "convertido", label: "Convertido", cls: "bg-emerald-600/20 border-emerald-600 text-emerald-800 hover:bg-emerald-600/30 font-semibold", key: "4" },
    { v: "sem_interesse", label: "Sem interesse", cls: "bg-red-500/15 border-red-500 text-red-700 hover:bg-red-500/25", key: "5" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Como foi a chamada?</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {options.map((o) => (
              <button
                key={o.v}
                onClick={() => setOutcome(o.v)}
                className={cn(
                  "p-3 rounded-md border-2 text-sm transition-all relative",
                  o.cls,
                  outcome === o.v && "ring-2 ring-offset-1 ring-primary",
                )}
              >
                <span className="absolute top-1 left-1.5 text-[10px] opacity-60">{o.key}</span>
                {o.label}
              </button>
            ))}
          </div>

          {outcome === "nao_atendeu" && (
            <label className="flex items-center gap-2 text-sm p-2 rounded border">
              <Checkbox checked={sendAuto} onCheckedChange={(v) => setSendAuto(!!v)} />
              <span className="flex-1">Enviar mensagem automática via WhatsApp</span>
              <MessageCircle className="h-4 w-4 text-emerald-600" />
            </label>
          )}

          {outcome === "reagendar" && (
            <div>
              <label className="text-xs font-medium">Data/hora do reagendamento</label>
              <Input type="datetime-local" value={reagendarAt} onChange={(e) => setReagendarAt(e.target.value)} />
            </div>
          )}

          <div>
            <label className="text-xs font-medium">Notas (opcional)</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observações da chamada..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={!outcome || setOutcomeM.isPending} className="gap-1">
            <CheckCircle2 className="h-4 w-4" /> Salvar e próximo lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

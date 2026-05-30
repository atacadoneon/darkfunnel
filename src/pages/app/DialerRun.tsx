import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Phone, PhoneOff, Pause, Square, ChevronRight, ChevronsRight, Loader2, Copy, CheckCircle2,
  Sparkles, AlertTriangle, Target as TargetIcon, MessageSquare, Search, X,
  Minimize2, Maximize2, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useStages } from "@/features/pipeline/hooks";
import { useMessages, useConversationById } from "@/features/inbox/hooks";
import { useQuery } from "@tanstack/react-query";
import { MessageThread } from "@/features/inbox/MessageThread";
import { Composer } from "@/features/inbox/Composer";
import { ConversationHeader } from "@/features/inbox/ConversationHeader";
import { ContactPanel } from "@/features/inbox/ContactPanel";
import {
  useCampaign, useQueue, useSetCampaignStatus, useSetOutcome, useAiCoach, fetchNextLead,
  sendNoAnswerMessage,
  type DialerQueueItem, type QueueOutcome, type AiCoach,
} from "@/features/dialer/hooks";
import { CallTimer } from "@/components/voice/CallTimer";
import { StandaloneDialpad } from "@/components/dialer/StandaloneDialpad";
import { cn } from "@/lib/utils";

type RunState = "idle" | "dialing" | "in_call" | "outcome";

function brl(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const sentimentMeta: Record<string, { label: string; cls: string }> = {
  positivo: { label: "🟢 Positivo", cls: "bg-emerald-500/20 text-emerald-50 border-emerald-300/30" },
  neutro: { label: "🟡 Neutro", cls: "bg-amber-500/20 text-amber-50 border-amber-300/30" },
  negativo: { label: "🔴 Negativo", cls: "bg-red-500/20 text-red-50 border-red-300/30" },
};

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
  const [coachMinimized, setCoachMinimized] = useState(false);
  const [coachHidden, setCoachHidden] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Fallback: se o item da fila não tem conversation_id, busca a conversa mais recente do contato.
  const { data: fallbackConvId } = useQuery({
    queryKey: ["dialer-contact-conversation", currentItem?.contact_id, ws?.id],
    enabled: !!currentItem?.contact_id && !currentItem?.conversation_id && !!ws,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await (supabase as any)
        .from("conversations")
        .select("id")
        .eq("workspace_id", ws!.id)
        .eq("contact_id", currentItem!.contact_id)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data?.id as string) ?? null;
    },
  });
  const resolvedConvId = currentItem?.conversation_id ?? fallbackConvId ?? null;
  const { data: conversation } = useConversationById(resolvedConvId);
  const { data: messages = [] } = useMessages(resolvedConvId);

  const stage = stages.find((s) => s.id === currentItem?.deal?.stage_id);
  const stageName = stage?.name ?? (currentItem as any)?.stage_name ?? null;
  const stageColor = stage?.color ?? "hsl(var(--primary))";
  const stageObjective = (stage as any)?.default_objective ?? (currentItem as any)?.default_objective;

  /* --------- AI Coach loader --------- */
  const loadCoach = useCallback((item: DialerQueueItem) => {
    if (!item?.id) return;
    setCoachLoading(true);
    setCoachHidden(false);
    setCoachMinimized(false);
    aiCoach.mutate(
      { contact_id: item.contact_id, deal_id: item.deal_id, queue_id: item.id },
      {
        onSuccess: (data) => { setCoach(data); setCoachLoading(false); },
        onError: () => { setCoachLoading(false); },
      },
    );
  }, [aiCoach]);

  /* --------- Select lead --------- */
  const selectLead = useCallback((item: DialerQueueItem) => {
    setCurrentItem(item);
    setRunState("idle");
    setCoach(null);
    loadCoach(item);
  }, [loadCoach]);

  /* --------- Boot / load next pending --------- */
  const loadNext = useCallback(async () => {
    if (!id) return;
    try {
      const next = await fetchNextLead(id);
      if (!next) {
        toast.success("Fila concluída!");
        await setStatus.mutateAsync({ id, status: "completed" });
        setCurrentItem(null);
        return;
      }
      selectLead(next);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao buscar próximo lead");
    }
  }, [id, selectLead, setStatus]);

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

  /* --------- Subscribe call status --------- */
  useEffect(() => {
    if (!activeCallId) return;
    const ch = supabase
      .channel(`call:${activeCallId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${activeCallId}` },
        (p: any) => {
          const st = p?.new?.status;
          if (st === "in_progress" && p?.new?.answered_at) {
            setCallStartedAt(p.new.answered_at);
            setRunState("in_call");
          }
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
    if (!/^\d{10,11}$/.test(to)) { toast.error(`Telefone inválido: "${to}"`); return; }
    setRunState("dialing");
    try {
      const { data, error } = await supabase.functions.invoke("voice-outbound", {
        body: { workspace_id: ws.id, to, contact_id: currentItem.contact_id, deal_id: currentItem.deal_id, channel: "pstn" },
      });
      if (error) {
        const message = String(error.message ?? "");
        const isZenviaNumberError = message.includes("numero_destino inválido") || message.includes("número_destino inválido");
        if (isZenviaNumberError && to.length === 10 && /^\d{2}9\d{7}$/.test(to)) {
          const mobileWithNinthDigit = `${to.slice(0, 2)}9${to.slice(2)}`;
          const retry = await supabase.functions.invoke("voice-outbound", {
            body: { workspace_id: ws.id, to: mobileWithNinthDigit, contact_id: currentItem.contact_id, deal_id: currentItem.deal_id, channel: "pstn" },
          });
          if (retry.error) throw retry.error;
          setActiveCallId((retry.data as any)?.call_id ?? null);
          setCallStartedAt(new Date().toISOString());
          return;
        }
        throw error;
      }
      setActiveCallId((data as any)?.call_id ?? null);
      setCallStartedAt(new Date().toISOString());
    } catch (e: any) {
      console.error("[Dialer] voice-outbound failed", e);
      toast.error(e?.message ?? "Erro ao ligar");
      setRunState("idle");
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


  const insertIntoComposer = useCallback((text: string) => {
    if (!currentItem?.conversation_id) {
      navigator.clipboard.writeText(text);
      toast.success("Texto copiado");
      return;
    }
    window.dispatchEvent(new CustomEvent("inbox:insert-text", {
      detail: { text, conversationId: currentItem.conversation_id },
    }));
    toast.success("Inserido no compositor");
  }, [currentItem]);

  const target = campaign?.target_count ?? 0;
  const done = campaign?.completed_count ?? 0;
  const pct = target > 0 ? Math.round((done / target) * 100) : 0;

  const filteredQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter((it) => {
      const name = (it.contact?.display_name ?? "").toLowerCase();
      const phone = (it.phone_e164 ?? it.contact?.phone_e164 ?? "").toLowerCase();
      const deal = (it.deal?.title ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q) || deal.includes(q);
    });
  }, [queue, search]);

  return (
    <div className="h-full flex flex-col bg-muted/20 min-h-0 overflow-hidden">
      {/* ============ TOP COMMAND BAR ============ */}
      <header className="bg-card border-b px-4 py-2.5 flex items-center gap-3 shrink-0 shadow-sm">
        <Button variant="ghost" size="sm" onClick={() => navigate("/discador")} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{campaign?.name ?? "Carregando..."}</div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="tabular-nums">{done}/{target}</span>
            <Progress value={pct} className="h-1 w-24" />
            <span>{pct}%</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Big action buttons */}
        <div className="flex items-center gap-2">
          {(runState === "idle" || runState === "outcome") && currentItem && (
            <Button
              size="lg"
              onClick={startCall}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md gap-2 h-11 px-5 font-semibold"
            >
              <Phone className="h-4 w-4" /> LIGAR
            </Button>
          )}

          {runState === "dialing" && (
            <div className="flex items-center gap-2 px-3 h-11 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              <span className="text-sm font-medium">Chamando...</span>
              <Button size="sm" variant="destructive" onClick={endCall} className="gap-1 h-8">
                <PhoneOff className="h-3.5 w-3.5" /> Cancelar
              </Button>
            </div>
          )}

          {runState === "in_call" && (
            <div className="flex items-center gap-2 px-3 h-11 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-400 dark:border-emerald-500/40">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <CallTimer startedAt={callStartedAt} className="text-sm font-mono font-semibold tabular-nums" />
              <Button size="sm" variant="destructive" onClick={endCall} className="gap-1 h-8">
                <PhoneOff className="h-3.5 w-3.5" /> Encerrar
              </Button>
            </div>
          )}

          <Button
            size="lg"
            onClick={loadNext}
            className="bg-primary text-primary-foreground shadow gap-2 h-11 px-4 font-semibold"
          >
            Próximo lead <ChevronRight className="h-4 w-4" />
          </Button>

          <Button size="lg" variant="outline" onClick={pauseCampaign} className="gap-2 h-11">
            <Pause className="h-4 w-4" /> Pausar
          </Button>

          <Button size="lg" variant="outline" onClick={endCampaign} className="gap-2 h-11 text-destructive hover:text-destructive">
            <Square className="h-4 w-4" /> Encerrar
          </Button>
        </div>
      </header>

      {/* ============ MAIN 3-COLUMN ============ */}
      <div className="flex-1 grid grid-cols-[300px_1fr_auto] min-h-0 overflow-hidden">
        {/* LEFT — QUEUE LIST */}
        <aside className="border-r bg-card flex flex-col min-h-0 overflow-hidden">
          <div className="p-2.5 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar na fila..."
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredQueue.length === 0 && (
              <div className="text-xs text-muted-foreground italic text-center py-8">
                {search ? "Sem resultados" : "Fila vazia"}
              </div>
            )}
            {filteredQueue.map((q) => {
              const isCurrent = q.id === currentItem?.id;
              const isDone = q.status === "completed";
              return (
                <div
                  key={q.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectLead(q)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectLead(q); } }}
                  className={cn(
                    "group w-full text-left p-2.5 flex items-center gap-2.5 border-b transition-colors hover:bg-muted/50 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isCurrent && "bg-primary/10 border-l-2 border-l-primary",
                    isDone && !isCurrent && "opacity-50",
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={q.contact?.profile_pic_url ?? undefined} />
                    <AvatarFallback className="text-[10px]">{(q.contact?.display_name ?? "?").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-xs truncate flex-1">
                        {q.contact?.display_name ?? q.phone_e164 ?? "Sem nome"}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">#{q.position ?? "-"}</Badge>
                    </div>
                    {q.deal && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {q.deal.title} · {brl(q.deal.value_cents)}
                      </div>
                    )}
                    <div className="flex items-center gap-1 mt-0.5">
                      {q.status === "pending" && <Badge variant="secondary" className="text-[9px] h-3.5 px-1">Aguardando</Badge>}
                      {q.status === "calling" && <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[9px] h-3.5 px-1">Chamando</Badge>}
                      {q.outcome === "atendeu" && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[9px] h-3.5 px-1">Atendeu</Badge>}
                      {q.outcome === "nao_atendeu" && <Badge variant="outline" className="text-[9px] h-3.5 px-1">N/A</Badge>}
                      {q.outcome === "convertido" && <Badge className="bg-purple-500/15 text-purple-700 border-purple-500/30 text-[9px] h-3.5 px-1">Convertido</Badge>}
                      {q.outcome === "sem_interesse" && <Badge variant="destructive" className="text-[9px] h-3.5 px-1">Sem interesse</Badge>}
                      {q.outcome === "reagendar" && <Badge className="bg-sky-500/15 text-sky-700 border-sky-500/30 text-[9px] h-3.5 px-1">Reagendar</Badge>}
                    </div>
                  </div>
                  {q.status === "pending" && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void loadNext(); }}
                      title="Pular este lead"
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* CENTER — CONVERSATION (reuse Inbox components) */}
        <section className="flex flex-col min-h-0 min-w-0 overflow-hidden bg-background">
          {!currentItem ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Phone className="h-12 w-12 opacity-30" />
              <span className="text-sm">Selecione um lead na fila ao lado</span>
            </div>
          ) : conversation ? (
            <>
              <ConversationHeader conversation={conversation} />
              <MessageThread
                messages={messages}
                contactAvatar={conversation.contacts?.profile_pic_url ?? null}
              />
              <Composer conversation={conversation} />
            </>
          ) : resolvedConvId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando conversa...
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <div>
                <MessageSquare className="h-12 w-12 mx-auto opacity-30 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa anterior com este lead.</p>
                <p className="text-xs mt-1 text-muted-foreground">Ligue para iniciar o contato.</p>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT — CONTACT PANEL (reuse from Inbox) */}
        {conversation ? (
          <ContactPanel conversation={conversation} />
        ) : (
          <aside className="w-[300px] shrink-0 border-l bg-card p-4 hidden lg:block">
            {currentItem ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={currentItem.contact?.profile_pic_url ?? undefined} />
                    <AvatarFallback>{(currentItem.contact?.display_name ?? "?").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{currentItem.contact?.display_name ?? "Sem nome"}</div>
                    <div className="text-xs text-muted-foreground">
                      {currentItem.phone_e164 ?? currentItem.contact?.phone_e164 ?? "—"}
                    </div>
                  </div>
                </div>
                {currentItem.deal && (
                  <div className="border rounded-md p-2 text-xs">
                    <div className="font-medium">{currentItem.deal.title}</div>
                    <div className="text-emerald-600">{brl(currentItem.deal.value_cents)}</div>
                  </div>
                )}
                {stageName && (
                  <Badge variant="outline" style={{ borderColor: stageColor, color: stageColor }}>
                    {stageName}
                  </Badge>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center">Selecione um lead</div>
            )}
          </aside>
        )}
      </div>

      {/* ============ FLOATING AI COACH POPUP ============ */}
      {currentItem && !coachHidden && (
        <div
          className={cn(
            "fixed bottom-4 right-4 w-[400px] max-w-[calc(100vw-2rem)] bg-card rounded-xl shadow-2xl border z-50 overflow-hidden",
            "border-purple-300 dark:border-purple-500/40",
          )}
        >
          <header className="bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white px-3.5 py-2.5 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <h3 className="font-semibold text-sm">AI Coach</h3>
            {coach?.sentimento && sentimentMeta[coach.sentimento as string] && (
              <Badge className={cn("ml-1 border text-[10px] h-5", sentimentMeta[coach.sentimento as string].cls)}>
                {sentimentMeta[coach.sentimento as string].label}
              </Badge>
            )}
            <div className="ml-auto flex items-center gap-0.5">
              <button onClick={() => loadCoach(currentItem)} title="Atualizar" className="p-1 rounded hover:bg-white/15">
                <RefreshCw className={cn("h-3.5 w-3.5", coachLoading && "animate-spin")} />
              </button>
              <button onClick={() => setCoachMinimized((v) => !v)} title={coachMinimized ? "Expandir" : "Minimizar"} className="p-1 rounded hover:bg-white/15">
                {coachMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
              </button>
              <button onClick={() => setCoachHidden(true)} title="Fechar" className="p-1 rounded hover:bg-white/15">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          {!coachMinimized && (
            <>
              <div className="max-h-[55vh] overflow-y-auto p-3 space-y-2.5 text-xs">
                {coachLoading && !coach && (
                  <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                    <span>IA analisando conversa...</span>
                  </div>
                )}

                {(stageObjective || coach?.objetivo) && (
                  <div className="bg-amber-500/10 border-l-4 border-amber-500 p-2.5 rounded">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-0.5">
                      <TargetIcon className="h-3 w-3" /> Objetivo da etapa
                    </div>
                    <div className="text-amber-900 dark:text-amber-100">{coach?.objetivo ?? stageObjective}</div>
                  </div>
                )}

                {coach?.resumo && coach.resumo.length > 0 && (
                  <div>
                    <div className="font-bold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">📋 Resumo</div>
                    <ul className="space-y-1">
                      {(Array.isArray(coach.resumo) ? coach.resumo : [coach.resumo]).map((r, i) => (
                        <li key={i} className="flex gap-1.5"><span className="text-purple-500">•</span><span>{r}</span></li>
                      ))}
                    </ul>
                  </div>
                )}

                {coach?.abertura && (
                  <div className="bg-sky-500/10 border border-sky-500/30 rounded p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-[10px] uppercase tracking-wide text-sky-700 dark:text-sky-300">💬 Abertura sugerida</div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { navigator.clipboard.writeText(coach.abertura!); toast.success("Copiado"); }}
                          className="text-[10px] text-sky-600 hover:bg-sky-500/15 px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                        >
                          <Copy className="h-3 w-3" /> Copiar
                        </button>
                        <button
                          onClick={() => insertIntoComposer(coach.abertura!)}
                          className="text-[10px] text-sky-700 dark:text-sky-200 hover:bg-sky-500/20 px-1.5 py-0.5 rounded font-semibold"
                        >
                          → Usar
                        </button>
                      </div>
                    </div>
                    <p className="italic text-sky-900 dark:text-sky-100">"{coach.abertura}"</p>
                  </div>
                )}

                {coach?.perguntas && coach.perguntas.length > 0 && (
                  <div>
                    <div className="font-bold text-[10px] uppercase tracking-wide text-muted-foreground mb-1">❓ Perguntas estratégicas</div>
                    <ol className="space-y-1">
                      {coach.perguntas.map((p, i) => (
                        <li key={i} className="flex gap-1.5 group items-start">
                          <span className="font-bold text-purple-600 shrink-0">{i + 1}.</span>
                          <span className="flex-1">{p}</span>
                          <button
                            onClick={() => insertIntoComposer(p)}
                            className="opacity-0 group-hover:opacity-100 text-purple-600 hover:bg-purple-500/15 p-0.5 rounded shrink-0"
                            title="Usar no compositor"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {coach?.objecao && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded p-2.5">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-300 mb-0.5">
                      <AlertTriangle className="h-3 w-3" /> Possível objeção
                    </div>
                    {typeof coach.objecao === "string" ? (
                      <div className="text-red-900 dark:text-red-100">{coach.objecao}</div>
                    ) : (
                      <div className="space-y-1">
                        {coach.objecao.texto && <div className="text-red-900 dark:text-red-100">{coach.objecao.texto}</div>}
                        {coach.objecao.resposta && (
                          <div className="italic text-muted-foreground">→ {coach.objecao.resposta}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {coach?.proximo_passo && (
                  <div className="bg-emerald-500/10 border-l-4 border-emerald-500 p-2.5 rounded">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-0.5">
                      ➡️ Próximo passo
                    </div>
                    <div className="font-medium text-emerald-900 dark:text-emerald-100">{coach.proximo_passo}</div>
                  </div>
                )}

                {!coachLoading && !coach && (
                  <div className="text-center text-muted-foreground py-4">Coach IA indisponível.</div>
                )}
              </div>

              <footer className="bg-muted/40 px-3 py-1.5 text-[10px] text-muted-foreground border-t flex items-center justify-between">
                <span>Powered by AI</span>
                <span className="opacity-60">AI Coach</span>
              </footer>
            </>
          )}
        </div>
      )}

      {/* Mini "Open coach" button when hidden */}
      {currentItem && coachHidden && (
        <button
          onClick={() => setCoachHidden(false)}
          className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white rounded-full shadow-xl p-3 hover:scale-105 transition-transform"
          title="Abrir AI Coach"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

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

  const options: { v: QueueOutcome; label: string; cls: string }[] = [
    { v: "atendeu", label: "Atendeu", cls: "bg-emerald-500/15 border-emerald-500 text-emerald-700 hover:bg-emerald-500/25" },
    { v: "nao_atendeu", label: "Não atendeu", cls: "bg-slate-500/15 border-slate-400 text-slate-700 hover:bg-slate-500/25" },
    { v: "reagendar", label: "Reagendar", cls: "bg-amber-500/15 border-amber-500 text-amber-700 hover:bg-amber-500/25" },
    { v: "convertido", label: "Convertido", cls: "bg-emerald-600/20 border-emerald-600 text-emerald-800 hover:bg-emerald-600/30 font-semibold" },
    { v: "sem_interesse", label: "Sem interesse", cls: "bg-red-500/15 border-red-500 text-red-700 hover:bg-red-500/25" },
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
                  "p-3 rounded-md border-2 text-sm transition-all",
                  o.cls,
                  outcome === o.v && "ring-2 ring-offset-1 ring-primary",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          {outcome === "nao_atendeu" && (
            <label className="flex items-center gap-2 text-sm p-2 rounded border">
              <Checkbox checked={sendAuto} onCheckedChange={(v) => setSendAuto(!!v)} />
              <span className="flex-1">Enviar mensagem automática via WhatsApp</span>
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

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button onClick={save} disabled={!outcome || setOutcomeM.isPending} className="gap-1 w-full bg-primary text-primary-foreground">
            <CheckCircle2 className="h-4 w-4" /> Salvar e próximo
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

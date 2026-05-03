import { useState } from "react";
import { format } from "date-fns";
import {
  Gift, Clock, ClipboardList, StickyNote, ArrowLeftRight,
  Sparkles, Plus, Loader2, Send, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspaceMembers } from "@/features/workspace/permissions";
import { useStages } from "@/features/pipeline/hooks";
import { DealDialog } from "@/features/pipeline/DealDialog";
import { LeadEditDialog } from "@/features/pipeline/LeadEditDialog";
import {
  useAddNote, useConversationNotes,
  useScheduleMessage, useScheduledMessages, useCancelScheduled,
  usePlaybooks, useStartCadence,
  useAssignConversation,
  useRunAIAnalysis, useAIAnalyses,
  useContactDeal,
} from "./inboxFeatureHooks";
import type { ConversationRow } from "./hooks";

type Props = { conversation: ConversationRow };

function IconBtn({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button" variant={active ? "default" : "outline"} size="icon"
            className="h-9 w-9" onClick={onClick} aria-label={label}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ConversationHeader({ conversation }: Props) {
  const c = conversation.contacts;
  const { data: members = [] } = useWorkspaceMembers();
  const assigned = members.find((m) => m.user_id === conversation.assigned_user_id);
  const assignedLabel = assigned?.display_name || assigned?.email || "Sem responsável";

  const [openSchedule, setOpenSchedule] = useState(false);
  const [openAnalysis, setOpenAnalysis] = useState(false);
  const [openPlaybook, setOpenPlaybook] = useState(false);
  const [openNotes, setOpenNotes] = useState(false);
  const [openDeal, setOpenDeal] = useState(false);

  const assign = useAssignConversation();
  const { data: stages = [] } = useStages();
  const { data: contactDeal } = useContactDeal(conversation.contact_id);

  return (
    <div className="h-14 border-b flex items-center px-4 gap-2">
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
        {(c?.display_name ?? c?.phone_e164 ?? "?").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="font-semibold truncate">{c?.display_name ?? "Sem nome"}</div>
        <div className="text-xs text-muted-foreground truncate">{c?.phone_e164}</div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Responsável */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center">
                {assignedLabel.charAt(0).toUpperCase()}
              </span>
              <span className="text-xs max-w-[110px] truncate">{assignedLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Atribuir conversa</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => assign.mutate({ conversation_id: conversation.id, user_id: null })}>
              Sem responsável
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {members.map((m) => (
              <DropdownMenuItem key={m.user_id} onClick={() => assign.mutate({ conversation_id: conversation.id, user_id: m.user_id })}>
                {conversation.assigned_user_id === m.user_id && <Check className="h-3 w-3 mr-2" />}
                {m.display_name || m.email || m.user_id.slice(0, 8)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <IconBtn label="Transferir conversa" onClick={() => {
          const el = document.activeElement as HTMLElement | null; el?.blur?.();
        }}>
          <ArrowLeftRight className="h-4 w-4" />
        </IconBtn>

        <IconBtn label="Agendar mensagem" onClick={() => setOpenSchedule(true)}>
          <Clock className="h-4 w-4" />
        </IconBtn>

        <IconBtn label="Análise de atendimento (IA)" onClick={() => setOpenAnalysis(true)}>
          <Gift className="h-4 w-4" />
        </IconBtn>

        <IconBtn label="Playbook / Cadência" onClick={() => setOpenPlaybook(true)}>
          <ClipboardList className="h-4 w-4" />
        </IconBtn>

        <Button size="sm" className="h-9 gap-1.5" onClick={() => setOpenDeal(true)}>
          <Plus className="h-3.5 w-3.5" />
          {contactDeal ? "Ver Lead" : "Novo Lead"}
        </Button>

        <IconBtn label="Notas internas" onClick={() => setOpenNotes(true)}>
          <StickyNote className="h-4 w-4" />
        </IconBtn>
      </div>

      {openSchedule && (
        <ScheduleDialog conversation={conversation} open={openSchedule} onOpenChange={setOpenSchedule} />
      )}
      {openAnalysis && (
        <AnalysisDialog conversation={conversation} open={openAnalysis} onOpenChange={setOpenAnalysis} />
      )}
      {openPlaybook && (
        <PlaybookDialog conversation={conversation} open={openPlaybook} onOpenChange={setOpenPlaybook} />
      )}
      {openNotes && (
        <NotesDialog conversation={conversation} open={openNotes} onOpenChange={setOpenNotes} />
      )}
      {openDeal && contactDeal && (
        <LeadEditDialog open={openDeal} onOpenChange={setOpenDeal} dealId={contactDeal.id} />
      )}
      {openDeal && !contactDeal && (
        <DealDialog
          open={openDeal} onOpenChange={setOpenDeal}
          stages={stages}
          deal={null}
        />
      )}
    </div>
  );
}

/* ============ Sub dialogs ============ */

function ScheduleDialog({ conversation, open, onOpenChange }: { conversation: ConversationRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [text, setText] = useState("");
  const [when, setWhen] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60_000);
    d.setSeconds(0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const sched = useScheduleMessage();
  const cancel = useCancelScheduled();
  const { data: pending = [] } = useScheduledMessages(conversation.id);

  const submit = async () => {
    if (!text.trim()) return;
    await sched.mutateAsync({
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      channel_id: conversation.channel_id,
      body: text.trim(),
      scheduled_for: new Date(when).toISOString(),
    });
    setText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agendar mensagem</DialogTitle>
          <DialogDescription>O envio acontecerá automaticamente no horário escolhido.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea rows={4} placeholder="Conteúdo da mensagem..." value={text} onChange={(e) => setText(e.target.value)} />
          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <label className="text-xs text-muted-foreground">Enviar em</label>
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
            <Button onClick={submit} disabled={sched.isPending || !text.trim()}>
              {sched.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1.5" /> Agendar</>}
            </Button>
          </div>

          {pending.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Pendentes ({pending.length})</div>
              {pending.map((p) => (
                <div key={p.id} className="flex items-start gap-2 rounded border p-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{p.payload?.body}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {format(new Date(p.scheduled_for), "dd/MM HH:mm")}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => cancel.mutate(p.id)}>
                    Cancelar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnalysisDialog({ conversation, open, onOpenChange }: { conversation: ConversationRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const run = useRunAIAnalysis();
  const { data: list = [] } = useAIAnalyses(conversation.id);
  const latest = list[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Análise de atendimento</DialogTitle>
          <DialogDescription>IA avalia a conversa e sugere melhorias para o atendente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button onClick={() => run.mutate(conversation.id)} disabled={run.isPending} className="w-full">
            {run.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Analisando...</> : "Gerar nova análise"}
          </Button>
          {latest && (
            <div className="space-y-3 border-t pt-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-base">{latest.score ?? "—"}/100</Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(latest.created_at), "dd/MM HH:mm")}</span>
              </div>
              <p className="leading-relaxed">{latest.summary}</p>
              {!!latest.strengths?.length && (
                <div><div className="font-medium text-emerald-600 mb-1">Pontos fortes</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-sm">{latest.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {!!latest.improvements?.length && (
                <div><div className="font-medium text-amber-600 mb-1">A melhorar</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-sm">{latest.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {!!latest.next_actions?.length && (
                <div><div className="font-medium text-primary mb-1">Próximos passos</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-sm">{latest.next_actions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlaybookDialog({ conversation, open, onOpenChange }: { conversation: ConversationRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: playbooks = [] } = usePlaybooks();
  const [pid, setPid] = useState<string | null>(null);
  const start = useStartCadence();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Playbook & Cadência</DialogTitle>
          <DialogDescription>Selecione um playbook para disparar uma cadência de follow-ups nesta conversa.</DialogDescription>
        </DialogHeader>
        {playbooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum playbook cadastrado. Crie em Configurações → Playbooks.</p>
        ) : (
          <div className="space-y-3">
            <Select value={pid ?? ""} onValueChange={setPid}>
              <SelectTrigger><SelectValue placeholder="Escolha um playbook" /></SelectTrigger>
              <SelectContent>
                {playbooks.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!pid || start.isPending}
              onClick={async () => {
                if (!pid) return;
                await start.mutateAsync({
                  conversation_id: conversation.id,
                  playbook_id: pid,
                  contact_id: conversation.contact_id,
                  channel_id: conversation.channel_id,
                });
                onOpenChange(false);
              }}
            >
              {start.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar cadência"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotesDialog({ conversation, open, onOpenChange }: { conversation: ConversationRow; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: notes = [] } = useConversationNotes(conversation.id);
  const add = useAddNote();
  const [body, setBody] = useState("");
  const submit = async () => {
    if (!body.trim()) return;
    await add.mutateAsync({ conversation_id: conversation.id, body: body.trim() });
    setBody("");
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><StickyNote className="h-4 w-4" /> Notas internas</DialogTitle>
          <DialogDescription>Visíveis apenas para o time. Não são enviadas ao cliente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Anote algo importante sobre essa conversa..." />
          <Button onClick={submit} disabled={add.isPending || !body.trim()} className="w-full">
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar nota"}
          </Button>
          <div className="space-y-2 max-h-72 overflow-auto border-t pt-3">
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma nota ainda.</p>
            ) : notes.map((n) => (
              <div key={n.id} className="rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/50 p-2 text-sm">
                <div className="whitespace-pre-wrap">{n.body}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}</div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

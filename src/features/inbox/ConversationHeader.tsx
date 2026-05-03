import { useState } from "react";
import { format } from "date-fns";
import {
  Gift, Clock, ClipboardList, StickyNote, Search,
  Sparkles, Plus, Loader2, Send, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useStages } from "@/features/pipeline/hooks";
import { DealDialog } from "@/features/pipeline/DealDialog";
import { LeadEditDialog } from "@/features/pipeline/LeadEditDialog";
import {
  useScheduleMessage, useScheduledMessages, useCancelScheduled,
  usePlaybooks, useStartCadence,
  useRunAIAnalysis, useAIAnalyses,
  useContactDeal,
} from "./inboxFeatureHooks";
import { AssigneePopover } from "./AssigneePopover";
import { StageMovePopover } from "./StageMovePopover";
import { ContactNotesDrawer } from "./ContactNotesDrawer";
import type { ConversationRow } from "./hooks";

type Props = {
  conversation: ConversationRow;
  onToggleSearch?: () => void;
  searchActive?: boolean;
};

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

export function ConversationHeader({ conversation, onToggleSearch, searchActive }: Props) {
  const c = conversation.contacts;

  const [openSchedule, setOpenSchedule] = useState(false);
  const [openAnalysis, setOpenAnalysis] = useState(false);
  const [openPlaybook, setOpenPlaybook] = useState(false);
  const [openNotes, setOpenNotes] = useState(false);
  const [openDeal, setOpenDeal] = useState(false);

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
        <AssigneePopover
          conversationId={conversation.id}
          assignedUserId={conversation.assigned_user_id}
        />

        {/* Mover etapa do lead */}
        {contactDeal && (
          <StageMovePopover dealId={contactDeal.id} currentStageId={contactDeal.stage_id} />
        )}

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

        <IconBtn label="Buscar nas mensagens" onClick={onToggleSearch} active={searchActive}>
          <Search className="h-4 w-4" />
        </IconBtn>

        <IconBtn label="Observações internas do contato" onClick={() => setOpenNotes(true)}>
          <FileText className="h-4 w-4" />
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
        <ContactNotesDrawer
          contactId={conversation.contact_id}
          open={openNotes}
          onOpenChange={setOpenNotes}
        />
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


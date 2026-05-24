import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Mail, Users, FileText, Send, Eye } from "lucide-react";
import {
  useCreateCampaign, useEmailLists, useEmailTemplates, htmlToText, isValidEmail,
  type EmailCampaign,
} from "./hooks";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; onCreated?: (c: EmailCampaign) => void };

export function NewCampaignDialog({ open, onOpenChange, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [listIds, setListIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledFor, setScheduledFor] = useState("");

  const { data: lists = [] } = useEmailLists();
  const { data: templates = [] } = useEmailTemplates();
  const createMut = useCreateCampaign();

  const totalRecipients = useMemo(
    () => lists.filter((l) => listIds.includes(l.id)).reduce((s, l) => s + (l.members_count ?? 0), 0),
    [lists, listIds]
  );

  function reset() {
    setStep(1); setName(""); setDescription(""); setListIds([]); setTemplateId("");
    setSubject(""); setPreheader(""); setFromName(""); setFromEmail(""); setReplyTo("");
    setBodyHtml(""); setSendMode("now"); setScheduledFor("");
  }

  function onTemplateSelect(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      if (!subject && t.subject) setSubject(t.subject);
      if (!bodyHtml && t.body_html) setBodyHtml(t.body_html);
    }
  }

  const canNext =
    step === 1 ? name.trim().length > 0
    : step === 2 ? listIds.length > 0
    : step === 3 ? subject.trim().length > 0 && bodyHtml.trim().length > 0 && fromEmail.trim().length > 0 && isValidEmail(fromEmail)
    : step === 4 ? (sendMode === "now" || !!scheduledFor)
    : true;

  async function handleCreate() {
    if (fromEmail && !isValidEmail(fromEmail)) return;
    if (replyTo && !isValidEmail(replyTo)) return;
    const created = await createMut.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      list_ids: listIds,
      template_id: templateId || null,
      subject: subject.trim(),
      preheader: preheader.trim() || null,
      from_name: fromName.trim() || null,
      from_email: fromEmail.trim(),
      reply_to: replyTo.trim() || null,
      body_html: bodyHtml,
      body_text: htmlToText(bodyHtml),
      status: sendMode === "schedule" ? "scheduled" : "draft",
      scheduled_for: sendMode === "schedule" ? new Date(scheduledFor).toISOString() : null,
    });
    onCreated?.(created as any);
    reset();
    onOpenChange(false);
  }

  const STEPS = [
    { n: 1, label: "Nome", icon: Mail },
    { n: 2, label: "Audiência", icon: Users },
    { n: 3, label: "Conteúdo", icon: FileText },
    { n: 4, label: "Envio", icon: Send },
    { n: 5, label: "Revisão", icon: Eye },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between border-b pb-3">
          {STEPS.map((s, i) => {
            const active = step === s.n; const done = step > s.n;
            const Icon = s.icon;
            return (
              <div key={s.n} className="flex items-center gap-2">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs ${active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={`text-xs ${active ? "font-semibold" : "text-muted-foreground"}`}>{s.label}</span>
                {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />}
              </div>
            );
          })}
        </div>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Black Friday 2026" /></div>
              <div><Label>Descrição</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <Label>Selecione as listas *</Label>
              {lists.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma lista criada ainda. Vá para a aba "Listas" para criar.</p> : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {lists.map((l) => (
                    <label key={l.id} className="flex items-center gap-3 p-2 rounded border hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={listIds.includes(l.id)} onCheckedChange={(v) => setListIds((prev) => v ? [...prev, l.id] : prev.filter((x) => x !== l.id))} />
                      <div className="flex-1"><div className="text-sm font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.members_count ?? 0} membros · {l.source}</div></div>
                    </label>
                  ))}
                </div>
              )}
              {listIds.length > 0 && <p className="text-xs text-muted-foreground">Total estimado: <span className="font-semibold text-foreground">{totalRecipients}</span> destinatários</p>}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <Label>Template (opcional)</Label>
                <Select value={templateId} onValueChange={onTemplateSelect}>
                  <SelectTrigger><SelectValue placeholder="Sem template — criar do zero" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Assunto *</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
                <div><Label>Preheader</Label><Input value={preheader} onChange={(e) => setPreheader(e.target.value)} /></div>
                <div><Label>Nome do remetente</Label><Input value={fromName} onChange={(e) => setFromName(e.target.value)} /></div>
                <div><Label>Email do remetente *</Label><Input type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} /></div>
                <div className="col-span-2"><Label>Responder para</Label><Input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} /></div>
              </div>
              <div><Label>Conteúdo HTML *</Label><Textarea rows={8} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} className="font-mono text-xs" placeholder="<h1>Olá</h1>..." /></div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <RadioGroup value={sendMode} onValueChange={(v) => setSendMode(v as any)}>
                <label className="flex items-center gap-2 p-3 rounded border cursor-pointer">
                  <RadioGroupItem value="now" /> <span className="text-sm">Salvar como rascunho (enviar manualmente depois)</span>
                </label>
                <label className="flex items-center gap-2 p-3 rounded border cursor-pointer">
                  <RadioGroupItem value="schedule" /> <span className="text-sm">Agendar envio</span>
                </label>
              </RadioGroup>
              {sendMode === "schedule" && (
                <div><Label>Data e hora</Label><Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} /></div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3 text-sm">
              <Row k="Nome" v={name} />
              <Row k="Descrição" v={description || "—"} />
              <Row k="Listas" v={`${listIds.length} listas · ${totalRecipients} destinatários`} />
              <Row k="Assunto" v={subject} />
              <Row k="Remetente" v={`${fromName || ""} <${fromEmail}>`} />
              <Row k="Envio" v={sendMode === "now" ? "Rascunho" : `Agendada para ${scheduledFor}`} />
              <div className="rounded border p-3 bg-muted/30"><div className="text-xs text-muted-foreground mb-1">Preview</div><div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: bodyHtml }} /></div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>
          {step < 5
            ? <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Próximo<ChevronRight className="h-4 w-4 ml-1" /></Button>
            : <Button disabled={createMut.isPending} onClick={handleCreate}>{createMut.isPending ? "Criando..." : "Criar campanha"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-4 border-b pb-1"><span className="text-muted-foreground">{k}</span><span className="font-medium text-right truncate">{v}</span></div>;
}

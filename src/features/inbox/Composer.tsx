import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Send, Calendar, Clock, MessagesSquare, Paperclip, Mic, Square, X, FileText, Image as ImageIcon, Video as VideoIcon, Music, Smile, Reply as ReplyIcon } from "lucide-react";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";
import { useQuickReplies, useScheduledMessages } from "./inboxFeatureHooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ConversationRow } from "./hooks";
import { makeOptimistic, optimisticStore } from "./optimisticMessages";


type Props = {
  conversation: ConversationRow;
};

type AttachmentType = "image" | "audio" | "video" | "document";

type Attachment = {
  file: File;
  type: AttachmentType;
  ptt?: boolean;
};

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,audio/ogg,audio/mpeg,audio/mp4,audio/wav,audio/webm,video/mp4,video/webm,video/quicktime,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
}

function detectType(mime: string): AttachmentType {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function Composer({ conversation }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; body: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { data: pendings = [] } = useScheduledMessages(conversation.id);
  const { data: quickReplies = [] } = useQuickReplies();

  const isCloud = conversation.channels?.kind === "whatsapp_cloud";
  const isUazapi = conversation.channels?.kind === "uazapi";
  const windowExpired =
    isCloud && conversation.window_expires_at
      ? new Date(conversation.window_expires_at) < new Date()
      : false;

  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      recStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string; body: string } | undefined;
      if (!detail) return;
      setReplyTo({ id: detail.id, body: detail.body });
      setTimeout(() => ref.current?.focus(), 0);
    };
    window.addEventListener("inbox:reply", handler as EventListener);
    return () => window.removeEventListener("inbox:reply", handler as EventListener);
  }, []);

  const handleFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!isUazapi) {
      toast.error("Mídia disponível só em UAZAPI por enquanto");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Arquivo excede 50MB");
      return;
    }
    setAttachment({ file: f, type: detectType(f.type || "") });
  };

  const startRecording = async () => {
    if (!isUazapi) {
      toast.error("Mídia disponível só em UAZAPI por enquanto");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      let mime = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "audio/ogg;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = mr;
      recChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const ext = (mr.mimeType || "").includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: blob.type });
        setAttachment({ file, type: "audio", ptt: true });
        recStreamRef.current?.getTracks().forEach((t) => t.stop());
        recStreamRef.current = null;
      };
      mr.start();
      setRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch (err) {
      toast.error("Não foi possível acessar microfone: " + (err as Error).message);
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
  };

  const send = async () => {
    if (!current) return;
    if (!attachment && !text.trim()) return;
    if (windowExpired) {
      toast.error("Janela 24h expirou. Envie um template HSM (em breve via UI).");
      return;
    }
    setSending(true);
    const rawBody = text.trim();
    const quoted = replyTo ? `> ${replyTo.body.split("\n").join("\n> ")}\n\n` : "";
    const body = quoted + rawBody;
    const att = attachment;
    const currentReply = replyTo;
    setText("");
    setAttachment(null);
    setReplyTo(null);

    // 1) Insert optimistic message immediately
    const optimistic = makeOptimistic({
      conversationId: conversation.id,
      type: att ? att.type : "text",
      body: body || (att ? att.file.name : ""),
      extraPayload: att
        ? { filename: att.file.name, mime: att.file.type, ptt: att.ptt ?? false }
        : undefined,
    });
    optimisticStore.add(conversation.id, optimistic);

    try {
      if (att) {
        if (!isUazapi) throw new Error("Mídia disponível só em UAZAPI por enquanto");
        const path = `${current.id}/${conversation.id}/${Date.now()}_${sanitizeFilename(att.file.name)}`;
        const up = await supabase.storage
          .from("darkfunnel-media")
          .upload(path, att.file, { contentType: att.file.type || undefined, upsert: false });
        if (up.error) throw new Error(up.error.message);
        const signed = await supabase.storage
          .from("darkfunnel-media")
          .createSignedUrl(path, 7 * 24 * 3600);
        if (signed.error || !signed.data?.signedUrl) throw new Error(signed.error?.message || "signed url failed");
        const { data, error } = await supabase.functions.invoke("uazapi-send", {
          body: {
            conversation_id: conversation.id,
            type: att.type,
            media_url: signed.data.signedUrl,
            text: body || undefined,
            filename: att.type === "document" ? att.file.name : undefined,
            ptt: att.type === "audio" ? true : undefined,
          },
        });
        if (error) throw new Error(error.message);
        optimisticStore.update(conversation.id, optimistic.id, {
          status: "sent",
          _externalId: (data as { external_id?: string } | null)?.external_id ?? null,
        });
      } else if (isUazapi) {
        const { data, error } = await supabase.functions.invoke("uazapi-send", {
          body: { conversation_id: conversation.id, type: "text", text: body },
        });
        console.log("[Composer] uazapi-send response:", { data, error });
        if (error) throw new Error(error.message);
        optimisticStore.update(conversation.id, optimistic.id, {
          status: "sent",
          _externalId: (data as { external_id?: string } | null)?.external_id ?? null,
        });
      } else {
        const { error } = await supabase.rpc("enqueue_outbound", {
          p_workspace: current.id,
          p_contact: conversation.contact_id,
          p_channel: conversation.channel_id,
          p_message_type: "text",
          p_payload: { body },
          p_context: "manual",
          p_conversation: conversation.id,
        });
        if (error) throw error;
        optimisticStore.update(conversation.id, optimistic.id, { status: "sent" });
      }
      // Defensive: refetch after a delay so the real DB row replaces the optimistic
      setTimeout(() => qc.invalidateQueries({ queryKey: ["messages", conversation.id] }), 1500);
      setTimeout(() => qc.invalidateQueries({ queryKey: ["messages", conversation.id] }), 4000);
    } catch (err) {
      optimisticStore.remove(conversation.id, optimistic.id);
      toast.error((err as Error).message);
      setText(rawBody);
      if (att) setAttachment(att);
      if (currentReply) setReplyTo(currentReply);
    } finally {
      setSending(false);
      ref.current?.focus();
    }
  };


  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const AttIcon = attachment
    ? attachment.type === "image"
      ? ImageIcon
      : attachment.type === "audio"
      ? Music
      : attachment.type === "video"
      ? VideoIcon
      : FileText
    : FileText;

  return (
    <div className="border-t bg-card px-2 py-1.5">

      {windowExpired && (
        <div className="mb-2 text-xs text-amber-600 dark:text-amber-400">
          Janela 24h da Cloud API expirou — apenas templates HSM são permitidos.
        </div>
      )}
      {pendings.length > 0 && (
        <button
          onClick={() => setScheduleOpen(true)}
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Clock className="h-3 w-3" />
          <Badge variant="secondary" className="h-5 px-1.5">{pendings.length}</Badge>
          mensagem(ns) agendada(s) — gerenciar
        </button>
      )}
      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-md border-l-4 border-primary bg-muted/40 p-2">
          <ReplyIcon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-primary">Respondendo</div>
            <div className="truncate text-xs text-muted-foreground">{replyTo.body}</div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyTo(null)} title="Cancelar resposta">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/40 p-2">
          <AttIcon className="h-5 w-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{attachment.file.name}</div>
            <div className="text-xs text-muted-foreground">
              {attachment.type}{attachment.ptt ? " · ptt" : ""} · {formatBytes(attachment.file.size)}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAttachment(null)} title="Remover">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {recording && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
          <span className="font-medium">Gravando…</span>
          <span className="ml-auto tabular-nums text-muted-foreground">{formatSeconds(recSeconds)}</span>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <div className="flex items-end gap-1">
        <Textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={windowExpired ? "Selecione um template..." : attachment ? "Caption (opcional)…" : "Digite uma mensagem... (/ para atalhos)"}
          disabled={windowExpired || recording}
          rows={1}
          className="resize-none min-h-[32px] max-h-32 text-sm py-1.5"
        />
        <Popover open={quickOpen} onOpenChange={setQuickOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              disabled={windowExpired || recording}
              title="Respostas rápidas"
            >
              <MessagesSquare className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Command>
              <CommandInput placeholder="Buscar resposta rápida..." />
              <CommandList>
                <CommandEmpty>Nenhuma resposta rápida.</CommandEmpty>
                <CommandGroup>
                  {quickReplies.map((reply) => (
                    <CommandItem
                      key={reply.id}
                      value={`${reply.shortcut ?? ""} ${reply.title} ${reply.payload?.body ?? ""}`}
                      onSelect={() => {
                        setText((currentText) => [currentText.trim(), reply.payload?.body ?? ""].filter(Boolean).join("\n"));
                        setQuickOpen(false);
                        setTimeout(() => ref.current?.focus(), 0);
                      }}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{reply.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {reply.shortcut ? `${reply.shortcut} · ` : ""}{reply.payload?.body ?? ""}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {isUazapi && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => fileRef.current?.click()}
            disabled={windowExpired || recording || !!attachment}
            title="Anexar arquivo"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={windowExpired || recording} title="Emoji">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-0" align="end">
            <EmojiPicker
              theme={Theme.AUTO}
              emojiStyle={EmojiStyle.NATIVE}
              onEmojiClick={(e) => {
                const el = ref.current;
                const emoji = e.emoji;
                if (el) {
                  const start = el.selectionStart ?? text.length;
                  const end = el.selectionEnd ?? text.length;
                  const next = text.slice(0, start) + emoji + text.slice(end);
                  setText(next);
                  setTimeout(() => {
                    el.focus();
                    const pos = start + emoji.length;
                    el.setSelectionRange(pos, pos);
                  }, 0);
                } else {
                  setText(text + emoji);
                }
              }}
            />
          </PopoverContent>
        </Popover>
        {isUazapi && (
          <Button
            variant={recording ? "destructive" : "ghost"}
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => (recording ? stopRecording() : void startRecording())}
            disabled={windowExpired || !!attachment}
            title={recording ? "Parar gravação" : "Gravar áudio"}
          >
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setScheduleOpen(true)}
          disabled={windowExpired || recording}
          title="Agendar"
        >
          <Calendar className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => void send()}
          disabled={sending || recording || (!text.trim() && !attachment) || windowExpired}
          size="icon"
          className="h-7 w-7 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-[10px] opacity-50 mt-0.5 text-center">Shift+Enter quebra linha · / atalhos · @ menciona</div>

      <ScheduleMessageDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        conversation={conversation}
        initialBody={text}
      />
    </div>
  );
}

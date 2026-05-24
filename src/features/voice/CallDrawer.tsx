import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, FileText, Languages, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDialer } from "./VoiceProvider";
import { formatBRL } from "@/features/wallet/hooks";
import { formatDuration, type CallRow } from "./hooks";
import { format } from "date-fns";

export function CallDrawer({ call, open, onOpenChange }: { call: CallRow | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const { open: openDialer } = useDialer();

  const rec = call?.recordings?.[0];
  const tr = call?.transcript?.[0];

  useEffect(() => {
    setSignedUrl(null);
    if (!rec?.storage_path) return;
    supabase.storage.from("call-recordings").createSignedUrl(rec.storage_path, 3600)
      .then(({ data }) => data?.signedUrl && setSignedUrl(data.signedUrl));
  }, [rec?.storage_path]);

  const seek = (sec: number) => {
    if (audioRef.current) { audioRef.current.currentTime = sec; audioRef.current.play(); }
  };

  if (!call) return null;
  const segments: any[] = Array.isArray(tr?.segments) ? tr!.segments : [];
  const topics: string[] = Array.isArray(tr?.key_topics) ? tr!.key_topics : [];
  const actions: string[] = Array.isArray(tr?.action_items) ? tr!.action_items : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{call.contact?.display_name ?? call.to_number}</SheetTitle>
          <div className="text-xs text-muted-foreground">
            {call.initiated_at && format(new Date(call.initiated_at), "dd/MM/yyyy HH:mm")} · {formatDuration(call.duration_seconds)} · {formatBRL(call.cost_cents ?? 0)}
          </div>
        </SheetHeader>

        {signedUrl ? (
          <audio ref={audioRef} controls src={signedUrl} className="w-full mt-4" />
        ) : (
          <div className="mt-4 text-xs text-muted-foreground italic">Sem gravação disponível</div>
        )}

        <Tabs defaultValue="transcript" className="mt-4">
          <TabsList>
            <TabsTrigger value="transcript"><FileText className="h-3.5 w-3.5 mr-1" />Transcrição</TabsTrigger>
            <TabsTrigger value="summary">Sumário IA</TabsTrigger>
            <TabsTrigger value="translation"><Languages className="h-3.5 w-3.5 mr-1" />Tradução</TabsTrigger>
            <TabsTrigger value="details"><Info className="h-3.5 w-3.5 mr-1" />Detalhes</TabsTrigger>
          </TabsList>
          <TabsContent value="transcript" className="space-y-1 max-h-[40vh] overflow-y-auto">
            {segments.length === 0 ? <p className="text-xs text-muted-foreground py-4">Sem transcrição</p> :
              segments.map((s, i) => (
                <button key={i} onClick={() => seek(s.start ?? 0)}
                  className="block w-full text-left p-2 rounded hover:bg-muted text-sm">
                  <span className="font-mono text-xs text-muted-foreground mr-2">{formatDuration(s.start ?? 0)}</span>
                  <span className="font-medium text-xs">{s.speaker ?? ""}</span>
                  <span className="ml-1">{s.text ?? ""}</span>
                </button>
              ))}
          </TabsContent>
          <TabsContent value="summary" className="space-y-3">
            {tr?.summary ? <p className="text-sm">{tr.summary}</p> : <p className="text-xs text-muted-foreground">Sem sumário ainda</p>}
            {tr?.sentiment && <Badge variant="outline">Sentimento: {tr.sentiment}</Badge>}
            {topics.length > 0 && <div className="flex flex-wrap gap-1">{topics.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>}
            {actions.length > 0 && (
              <ul className="text-sm space-y-1 list-disc list-inside">{actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            )}
          </TabsContent>
          <TabsContent value="translation">
            {tr?.translated_text ? <p className="text-sm whitespace-pre-wrap">{tr.translated_text}</p> : <p className="text-xs text-muted-foreground">Sem tradução</p>}
          </TabsContent>
          <TabsContent value="details" className="text-sm space-y-1">
            <div><b>SID:</b> <span className="font-mono text-xs">{call.twilio_sid ?? "—"}</span></div>
            <div><b>De → Para:</b> {call.from_number} → {call.to_number}</div>
            <div><b>Direção:</b> {call.direction}</div>
            <div><b>Canal:</b> {call.channel}</div>
            <div><b>Status:</b> {call.status}</div>
            <div><b>Outcome:</b> {call.outcome ?? "—"}</div>
            <div><b>Custo:</b> {formatBRL(call.cost_cents ?? 0)}</div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => openDialer({ phone: call.to_number, contactId: call.contact_id, contactName: call.contact?.display_name ?? null, channel: (call.channel ?? "pstn") as any })}>
            <Phone className="h-4 w-4 mr-1" /> Ligar de novo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

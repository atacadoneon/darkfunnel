import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateLandingPage } from "@/hooks/useLandingPages";

export function LandingPageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [msg, setMsg] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const create = useCreateLandingPage();

  const submit = async () => {
    if (!name.trim() || !slug.trim()) return;
    await create.mutateAsync({
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      whatsapp_number: whatsapp.trim() || null,
      prefilled_message: msg.trim() || null,
      utm_source: utmSource.trim() || null,
      utm_medium: utmMedium.trim() || null,
      utm_campaign: utmCampaign.trim() || null,
    });
    onClose();
    setName(""); setSlug(""); setWhatsapp(""); setMsg(""); setUtmSource(""); setUtmMedium(""); setUtmCampaign("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova landing page</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="black-friday" /></div>
          <div><Label>WhatsApp (E.164)</Label><Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+5511999999999" /></div>
          <div><Label>Mensagem pré-preenchida</Label><Textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>UTM source</Label><Input value={utmSource} onChange={(e) => setUtmSource(e.target.value)} /></div>
            <div><Label>UTM medium</Label><Input value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} /></div>
            <div><Label>UTM campaign</Label><Input value={utmCampaign} onChange={(e) => setUtmCampaign(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? "Criando..." : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTrackingConfig, useUpsertTrackingConfig } from "@/hooks/useTrackingConfigs";

export function TrackingConfigDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useTrackingConfig();
  const upsert = useUpsertTrackingConfig();
  const [metaPixel, setMetaPixel] = useState("");
  const [googleCid, setGoogleCid] = useState("");
  const [sendMeta, setSendMeta] = useState(false);
  const [sendGoogle, setSendGoogle] = useState(false);

  useEffect(() => {
    if (data) {
      setMetaPixel(data.meta_pixel_id ?? "");
      setGoogleCid(data.google_customer_id ?? "");
      setSendMeta(!!data.lp_send_lead_to_meta);
      setSendGoogle(!!data.lp_send_lead_to_google);
    }
  }, [data]);

  const submit = async () => {
    await upsert.mutateAsync({
      meta_pixel_id: metaPixel || null,
      google_customer_id: googleCid || null,
      lp_send_lead_to_meta: sendMeta,
      lp_send_lead_to_google: sendGoogle,
    });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        <SheetHeader><SheetTitle>Configurações de Trackeamento</SheetTitle></SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Meta Pixel ID</Label>
            <Input value={metaPixel} onChange={(e) => setMetaPixel(e.target.value)} placeholder="1234567890" />
          </div>
          <div className="space-y-2">
            <Label>Google Ads Customer ID</Label>
            <Input value={googleCid} onChange={(e) => setGoogleCid(e.target.value)} placeholder="123-456-7890" />
          </div>
          <div className="flex items-center justify-between">
            <Label>Enviar leads de LP para Meta</Label>
            <Switch checked={sendMeta} onCheckedChange={setSendMeta} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Enviar leads de LP para Google</Label>
            <Switch checked={sendGoogle} onCheckedChange={setSendGoogle} />
          </div>
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{upsert.isPending ? "Salvando..." : "Salvar"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

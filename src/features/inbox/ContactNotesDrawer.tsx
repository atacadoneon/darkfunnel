import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { format } from "date-fns";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contactId: string;
};

type ContactNotesRow = {
  internal_notes: string | null;
  internal_notes_updated_at: string | null;
  internal_notes_updated_by: string | null;
};

export function ContactNotesDrawer({ open, onOpenChange, contactId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contact-internal-notes", contactId],
    enabled: open && !!contactId,
    queryFn: async (): Promise<ContactNotesRow | null> => {
      const { data, error } = await supabase
        .from("contacts")
        .select("internal_notes,internal_notes_updated_at,internal_notes_updated_by")
        .eq("id", contactId)
        .maybeSingle();
      if (error) throw error;
      return data as ContactNotesRow | null;
    },
  });

  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const initialized = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data && !initialized.current) {
      setValue(data.internal_notes ?? "");
      setSavedAt(data.internal_notes_updated_at ?? null);
      initialized.current = true;
    }
  }, [data]);

  useEffect(() => {
    if (!open) { initialized.current = false; }
  }, [open]);

  const persist = async (v: string) => {
    setSaving(true);
    const { error } = await supabase.from("contacts").update({
      internal_notes: v,
      internal_notes_updated_at: new Date().toISOString(),
      internal_notes_updated_by: user?.id ?? null,
    }).eq("id", contactId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSavedAt(new Date().toISOString());
    qc.invalidateQueries({ queryKey: ["contact-internal-notes", contactId] });
  };

  const onChange = (v: string) => {
    setValue(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void persist(v), 800);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Observações Internas
          </SheetTitle>
          <SheetDescription>Notas visíveis apenas para a equipe interna</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Digite observações sobre este contato..."
            rows={14}
            disabled={isLoading}
            className="resize-none"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {saving ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Salvando...</span>
                : savedAt ? `Salvo em ${format(new Date(savedAt), "dd/MM HH:mm")}`
                : "Salvamento automático"}
            </span>
            <span>{value.length} caracteres</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

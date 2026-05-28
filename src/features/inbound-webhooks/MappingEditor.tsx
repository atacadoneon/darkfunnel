import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Target = { key: string; label: string; section: "contact" | "deal" };

const TARGETS: Target[] = [
  { key: "name", label: "Nome", section: "contact" },
  { key: "email", label: "E-mail", section: "contact" },
  { key: "phone_e164", label: "Telefone (E.164)", section: "contact" },
  { key: "whatsapp", label: "WhatsApp", section: "contact" },
  { key: "cpf", label: "CPF", section: "contact" },
  { key: "notes", label: "Notas", section: "contact" },
  { key: "title", label: "Título do Deal", section: "deal" },
  { key: "value_cents", label: "Valor (centavos)", section: "deal" },
  { key: "notes_deal", label: "Notas do Deal", section: "deal" },
];

function resolvePath(obj: any, path: string): any {
  if (!path?.startsWith("$.")) return undefined;
  const parts = path.slice(2).split(/[.[\]]/).filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

type Props = {
  sample: string;
  setSample: (v: string) => void;
  mapping: { fields: Record<string, string> };
  setMapping: (m: { fields: Record<string, string> }) => void;
};

export function MappingEditor({ sample, setSample, mapping, setMapping }: Props) {
  let parsed: any = null;
  try { parsed = JSON.parse(sample); } catch {}

  const setField = (k: string, v: string) => {
    const next = { ...mapping.fields };
    if (v) next[k] = v; else delete next[k];
    setMapping({ ...mapping, fields: next });
  };

  return (
    <div className="grid grid-cols-2 gap-4 h-[420px]">
      <div className="flex flex-col space-y-2">
        <Label className="text-xs">Payload de exemplo (JSON)</Label>
        <Textarea
          className="font-mono text-xs flex-1 resize-none"
          value={sample}
          onChange={(e) => setSample(e.target.value)}
        />
      </div>

      <div className="flex flex-col space-y-2 overflow-hidden">
        <Label className="text-xs">Mapeamento (use $.path)</Label>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {(["contact", "deal"] as const).map((section) => (
            <div key={section}>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{section}</p>
              <div className="space-y-1.5">
                {TARGETS.filter((t) => t.section === section).map((t) => {
                  const path = mapping.fields[t.key] ?? "";
                  const resolved = parsed && path ? resolvePath(parsed, path) : undefined;
                  return (
                    <div key={t.key} className="grid grid-cols-[120px,1fr,80px] gap-2 items-center">
                      <span className="text-xs">{t.label}</span>
                      <Input
                        className="h-7 text-xs font-mono"
                        value={path}
                        onChange={(e) => setField(t.key, e.target.value)}
                        placeholder="$.field"
                      />
                      <span className={`text-[10px] truncate ${resolved != null ? "text-emerald-600" : path ? "text-amber-600" : "text-muted-foreground"}`}>
                        {resolved != null ? String(resolved).slice(0, 20) : path ? "n/a" : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

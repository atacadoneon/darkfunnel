import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useStages } from "./hooks";
import { useLeadOrigins } from "./configHooks";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

type FieldKey = "ignore" | "name" | "phone" | "email" | "title" | "value" | "notes";
const FIELD_OPTIONS: { key: FieldKey; label: string }[] = [
  { key: "ignore", label: "Ignorar" },
  { key: "name", label: "Nome do contato" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "title", label: "Título do lead" },
  { key: "value", label: "Valor (R$)" },
  { key: "notes", label: "Notas" },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { buf += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else buf += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === "," || c === ";") { cur.push(buf); buf = ""; }
      else if (c === "\n") { cur.push(buf); rows.push(cur); cur = []; buf = ""; }
      else if (c === "\r") { /* skip */ }
      else buf += c;
    }
  }
  if (buf.length || cur.length) { cur.push(buf); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}

function normalizePhone(v: string): string | null {
  const digits = v.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return "+" + digits;
  if (digits.length >= 10) return "+55" + digits;
  return "+" + digits;
}

function autoDetect(header: string): FieldKey {
  const h = header.toLowerCase().trim();
  if (/(nome|name|cliente|contato)/.test(h)) return "name";
  if (/(tel|fone|phone|whats|celular|mobile)/.test(h)) return "phone";
  if (/(mail|email|e-mail)/.test(h)) return "email";
  if (/(titulo|title|assunto|deal|negocio)/.test(h)) return "title";
  if (/(valor|value|preço|preco|amount|price)/.test(h)) return "value";
  if (/(nota|note|obs|coment|descri)/.test(h)) return "notes";
  return "ignore";
}

export function CsvImportDialog({ open, onOpenChange }: Props) {
  const { current } = useWorkspace();
  const qc = useQueryClient();
  const { data: stages = [] } = useStages();
  const { data: origins = [] } = useLeadOrigins();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [header, setHeader] = useState<string[]>([]);
  const [mapping, setMapping] = useState<FieldKey[]>([]);
  const [stageId, setStageId] = useState<string>("");
  const [originId, setOriginId] = useState<string>("__none");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  const reset = () => {
    setStep(1); setFile(null); setRows([]); setHeader([]); setMapping([]);
    setStageId(""); setOriginId("__none"); setProgress(0); setResult(null); setRunning(false);
  };

  const handleClose = (v: boolean) => { if (!running) { onOpenChange(v); if (!v) setTimeout(reset, 200); } };

  const onPickFile = async (f: File) => {
    setFile(f);
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) { toast.error("CSV vazio ou inválido"); return; }
    const [h, ...body] = parsed;
    setHeader(h);
    setRows(body);
    setMapping(h.map(autoDetect));
    if (stages[0]) setStageId(stages[0].id);
    setStep(2);
  };

  const preview = rows.slice(0, 5);
  const hasName = mapping.includes("name");
  const hasPhone = mapping.includes("phone");
  // Lead = Contato = Conversa: telefone é OBRIGATÓRIO. Sem coluna telefone, sem import.
  const hasIdentifier = hasPhone;

  const runImport = async () => {
    if (!current || !stageId) return;
    setRunning(true);
    setStep(3);
    let ok = 0, fail = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const get = (k: FieldKey) => {
        const idx = mapping.indexOf(k);
        return idx >= 0 ? (row[idx] ?? "").trim() : "";
      };
      try {
        const name = get("name") || null;
        const phoneRaw = get("phone");
        const email = get("email") || null;
        const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
        const title = get("title") || name || phone || email || `Lead ${i + 1}`;
        const valueStr = get("value").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
        const valueNum = parseFloat(valueStr);
        const value_cents = isFinite(valueNum) ? Math.round(valueNum * 100) : 0;
        const notes = get("notes") || null;

        // upsert contact (by phone if exists, else create)
        let contactId: string | null = null;
        if (phone) {
          const { data: existing } = await supabase.from("contacts")
            .select("id").eq("workspace_id", current.id).eq("phone_e164", phone).maybeSingle();
          if (existing) contactId = existing.id;
        }
        if (!contactId) {
          const { data: created, error: cErr } = await supabase.from("contacts").insert({
            workspace_id: current.id,
            display_name: name,
            phone_e164: phone,
          }).select("id").single();
          if (cErr) throw cErr;
          contactId = created.id;
          if (email) {
            await supabase.from("contact_identities").insert({
              workspace_id: current.id, contact_id: contactId, kind: "email", value: email, is_primary: true,
            });
          }
        }

        const dealRow: any = {
          workspace_id: current.id,
          stage_id: stageId,
          contact_id: contactId,
          title,
          value_cents,
          notes,
          status: "open",
        };
        if (originId !== "__none") dealRow.origin_id = originId;

        const { error: dErr } = await supabase.from("deals").insert(dealRow);
        if (dErr) throw dErr;
        ok++;
      } catch (e: any) {
        fail++;
        if (errors.length < 10) errors.push(`Linha ${i + 2}: ${e.message || "erro"}`);
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setResult({ ok, fail, errors });
    setRunning(false);
    qc.invalidateQueries({ queryKey: ["deals", current.id] });
    qc.invalidateQueries({ queryKey: ["contacts", current.id] });
    if (ok > 0) toast.success(`${ok} leads importados`);
    if (fail > 0) toast.error(`${fail} falharam`);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Importar leads via CSV
          </DialogTitle>
          <DialogDescription>
            Passo {step} de 3 · {step === 1 ? "Escolha o arquivo" : step === 2 ? "Mapeie as colunas" : "Resultado"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Card className="border-dashed border-2 p-10 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">Arraste seu arquivo CSV ou clique abaixo</p>
              <p className="text-xs text-muted-foreground mb-4">
                Aceita separador vírgula (,) ou ponto-e-vírgula (;). UTF-8 recomendado.
              </p>
              <input
                type="file" accept=".csv,text/csv" id="csv-file" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }}
              />
              <label
                htmlFor="csv-file"
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
              >
                <Upload className="h-4 w-4 mr-2" /> Selecionar arquivo
              </label>
            </Card>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Dica:</strong> Inclua um cabeçalho com nomes claros (Nome, Telefone, E-mail, Valor...).</p>
              <p>Telefones serão normalizados para o formato +55 automaticamente.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{file?.name}</span>
              <Badge variant="secondary">{rows.length} linhas</Badge>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={reset}>
                <X className="h-3 w-3 mr-1" /> Trocar arquivo
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Etapa de destino *</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Origem (opcional)</Label>
                <Select value={originId} onValueChange={setOriginId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Nenhuma</SelectItem>
                    {origins.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Mapeamento de colunas</Label>
              <Card className="overflow-hidden">
                <div className="max-h-[300px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        {header.map((h, i) => (
                          <th key={i} className="px-2 py-2 text-left font-medium border-b">
                            <div className="space-y-1.5">
                              <div className="text-[11px] text-muted-foreground truncate" title={h}>{h || `(coluna ${i + 1})`}</div>
                              <Select value={mapping[i] ?? "ignore"} onValueChange={(v) => {
                                const next = [...mapping]; next[i] = v as FieldKey; setMapping(next);
                              }}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {FIELD_OPTIONS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, ri) => (
                        <tr key={ri} className="border-b last:border-0">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-2 py-1.5 truncate max-w-[180px]" title={cell}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-xs text-muted-foreground px-3 py-2 border-t bg-muted/30">
                  Mostrando {preview.length} de {rows.length} linhas
                </div>
              </Card>
            </div>

            {!hasIdentifier && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 px-3 py-2 rounded">
                <AlertCircle className="h-4 w-4" /> Mapeie obrigatoriamente a coluna <strong>Telefone</strong>. Lead sem telefone não é aceito.
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
              <Button onClick={runImport} disabled={!stageId || !hasIdentifier}>
                Importar {rows.length} leads <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-4">
            {running ? (
              <div className="text-center space-y-3">
                <Upload className="h-10 w-10 mx-auto text-primary animate-pulse" />
                <p className="text-sm font-medium">Importando leads...</p>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">{progress}% concluído</p>
              </div>
            ) : result && (
              <div className="space-y-4">
                <div className="text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-2" />
                  <h3 className="font-semibold text-lg">Importação concluída</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{result.ok}</div>
                    <div className="text-xs text-muted-foreground">Importados com sucesso</div>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-500">{result.fail}</div>
                    <div className="text-xs text-muted-foreground">Falharam</div>
                  </Card>
                </div>
                {result.errors.length > 0 && (
                  <Card className="p-3 bg-red-500/5 border-red-500/20">
                    <div className="text-xs font-medium mb-1">Primeiros erros:</div>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
                    </ul>
                  </Card>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={reset}>Importar outro</Button>
                  <Button onClick={() => handleClose(false)}>Fechar</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

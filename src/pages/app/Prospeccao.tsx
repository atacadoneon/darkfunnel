import { useMemo, useState } from "react";
import { Search, ChevronDown, Loader2, Download } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

type Cnae = { code: string; description: string };
type ResultRow = {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string | null;
  uf: string;
  municipio: string;
  telefone?: string | null;
  email?: string | null;
};

type ProspectFilters = {
  cnae: Cnae | null;
  ufs: string[];
  municipio: string;
  porte: string;
  situacao: string;
  razao: string;
  limit: number;
  bairro: string;
  ddd: string;
  yearFrom: number;
  yearTo: number;
  onlyEmail: boolean;
  onlyPhone: boolean;
  onlyHQ: boolean;
  mei: string;
  simples: string;
  capitalMin: string;
};

type SavedSearch = {
  id: string;
  name: string;
  filters: Partial<ProspectFilters>;
  created_at?: string | null;
  results?: ResultRow[];
};

const LOCAL_SAVED_SEARCHES_KEY = "prospeccao:saved-searches";

function readLocalSavedSearches(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_SAVED_SEARCHES_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function CnaeAutocomplete({ value, onChange }: { value: Cnae | null; onChange: (c: Cnae | null) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data: options = [], isLoading } = useQuery({
    queryKey: ["cnae-search", q],
    queryFn: async () => {
      if (q.length < 2) return [];
      const { data } = await supabase.functions.invoke("prospect-search-cnpj", {
        body: { action: "search_cnae_descriptions", q },
      });
      return (data?.results ?? []) as Cnae[];
    },
    enabled: q.length >= 2,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between h-8 text-xs font-normal">
          <span className="truncate">
            {value ? `${value.code} — ${value.description}` : "Buscar CNAE por descrição ou código..."}
          </span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar CNAE (mín 2 caracteres)..."
            className="h-8 text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {isLoading && <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> buscando…</div>}
          {!isLoading && q.length < 2 && (
            <div className="p-3 text-xs text-muted-foreground">Digite ao menos 2 caracteres</div>
          )}
          {!isLoading && q.length >= 2 && options.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">Nenhum CNAE encontrado</div>
          )}
          {options.map((o) => (
            <button
              key={o.code}
              type="button"
              className="w-full text-left p-2 hover:bg-muted text-xs border-b last:border-0"
              onClick={() => { onChange(o); setOpen(false); }}
            >
              <div className="font-mono text-[10px] text-muted-foreground">{o.code}</div>
              <div>{o.description}</div>
            </button>
          ))}
          {value && (
            <button
              type="button"
              className="w-full text-left p-2 hover:bg-muted text-xs text-destructive border-t"
              onClick={() => { onChange(null); setOpen(false); }}
            >
              Limpar seleção
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Prospeccao() {
  const { current } = useWorkspace();
  const wsName = current?.name ?? "Workspace";

  const [cnae, setCnae] = useState<Cnae | null>(null);
  const [ufs, setUfs] = useState<string[]>([]);
  const [municipio, setMunicipio] = useState("");
  const [porte, setPorte] = useState<string>("any");
  const [situacao, setSituacao] = useState<string>("active");
  const [razao, setRazao] = useState("");
  const [limit, setLimit] = useState(100);
  const [bairro, setBairro] = useState("");
  const [ddd, setDdd] = useState("");
  const [yearFrom, setYearFrom] = useState(2018);
  const [yearTo, setYearTo] = useState(2024);
  const [onlyEmail, setOnlyEmail] = useState(false);
  const [onlyPhone, setOnlyPhone] = useState(false);
  const [onlyHQ, setOnlyHQ] = useState(true);
  const [mei, setMei] = useState<string>("any");
  const [simples, setSimples] = useState<string>("any");
  const [capitalMin, setCapitalMin] = useState("");

  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canSearch = razao.replace(/\D/g, "").length === 14;

  // Filtros mantidos para UI; backend atual só suporta lookup por CNPJ.
  void cnae; void municipio; void porte; void situacao; void limit;
  void bairro; void ddd; void yearFrom; void yearTo; void onlyEmail; void onlyPhone;
  void onlyHQ; void mei; void simples; void capitalMin;

  const filteredResults = useMemo(
    () => results?.filter((row) => ufs.length === 0 || ufs.includes(row.uf)) ?? null,
    [results, ufs],
  );

  const searchMut = useMutation({
    mutationFn: async () => {
      const cnpjDigits = razao.replace(/\D/g, "");
      if (cnpjDigits.length !== 14) {
        throw new Error("Digite um CNPJ válido (14 dígitos) no campo de busca. A busca por filtros ainda não está disponível.");
      }
      const { data, error } = await supabase.functions.invoke("prospect-search-cnpj", {
        body: { action: "lookup_cnpj", cnpj: cnpjDigits, workspace_id: current?.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const result = data?.result ?? data?.results?.[0];
      return result ? [result as ResultRow] : [];
    },
    onSuccess: (rows) => {
      setResults(rows);
      setSelected(new Set());
      toast.success(`${rows.length} empresa(s) encontrada(s)`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha na busca"),
  });

  const importMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke("prospect-search-cnpj", {
        body: { action: "import_as_lead", workspace_id: current?.id, result_ids: ids },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (d: any) => toast.success(`${d?.imported ?? selected.size} leads importados`),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao importar"),
  });

  const toggleUF = (uf: string) => {
    setUfs((p) => p.includes(uf) ? p.filter((x) => x !== uf) : [...p, uf]);
    setSelected(new Set());
  };
  const toggleRow = (id: string) => setSelected((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const selectAll = () => setSelected(new Set((filteredResults ?? []).map((r) => r.id)));
  const clearSelection = () => setSelected(new Set());
  const importSelected = () => { if (selected.size === 0) return toast.error("Selecione pelo menos 1"); importMut.mutate([...selected]); };
  const importOne = (id: string) => importMut.mutate([id]);

  const exportXlsx = () => {
    if (!filteredResults?.length) return;
    const header = ["CNPJ","Razão Social","Fantasia","UF","Município","Telefone","Email"];
    const rows = filteredResults.map((r) => [r.cnpj, r.razao_social, r.nome_fantasia ?? "", r.uf, r.municipio, r.telefone ?? "", r.email ?? ""]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `prospeccao-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            <Search className="w-4 h-4" /> Prospecção
            <span className="text-xs text-muted-foreground font-normal">· {wsName}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gere listas de empresas brasileiras filtradas por CNAE (base pública Receita Federal)
          </p>
        </div>
        <div className="flex gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">Buscas salvas</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="px-3 py-2 border-b text-xs font-medium">Buscas salvas</div>
              <div className="p-4 text-xs text-muted-foreground text-center">
                Nenhuma busca salva ainda.
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" onClick={exportXlsx} disabled={!filteredResults?.length}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar
          </Button>
        </div>
      </div>

      <div className="rounded border bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Como funciona:</strong> Os dados vêm da base CNPJ pública da Receita Federal.
        Defina os filtros (ao menos 1 CNAE ou razão social), rode a busca e selecione empresas pra enviar pro CRM como leads.
        Uso permitido: apenas B2B em legítimo interesse (LGPD art. 7º IX).
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <Badge variant="outline" className="text-[10px]">Adicione 1 CNAE ou 3+ letras de razão pra habilitar a busca</Badge>
          <span className="text-[10px] text-muted-foreground">Filtre por nicho, UF, porte e mais</span>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">CNAE (nicho da empresa)</Label>
          <CnaeAutocomplete value={cnae} onChange={setCnae} />
        </div>

        <div className="mt-3">
          <Label className="text-xs">UF (múltiplas)</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {UFS.map((uf) => (
              <button
                key={uf}
                type="button"
                onClick={() => toggleUF(uf)}
                aria-pressed={ufs.includes(uf)}
                className={cn(
                  "h-6 px-2 text-[11px] rounded border transition-colors",
                  ufs.includes(uf)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted",
                )}
              >
                {uf}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="space-y-1">
            <Label className="text-xs">Município (parcial)</Label>
            <Input className="h-8 text-xs" placeholder="ex: Belo Horizonte" value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Porte</Label>
            <Select value={porte} onValueChange={setPorte}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Qualquer</SelectItem>
                <SelectItem value="mei">MEI</SelectItem>
                <SelectItem value="me">Micro</SelectItem>
                <SelectItem value="epp">Pequena (EPP)</SelectItem>
                <SelectItem value="demais">Média/Grande</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Situação</Label>
            <Select value={situacao} onValueChange={setSituacao}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Só ativas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CNPJ (14 dígitos)</Label>
            <Input
              className="h-8 text-xs font-mono"
              value={razao}
              onChange={(e) => setRazao(e.target.value)}
              placeholder="08.147.973/0001-60"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Limite (máx 500)</Label>
            <Input className="h-8 text-xs" type="number" min={1} max={500} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bairro/rua contém</Label>
            <Input className="h-8 text-xs" value={bairro} onChange={(e) => setBairro(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">DDD (vírgula)</Label>
            <Input className="h-8 text-xs" placeholder="11, 21, 31" value={ddd} onChange={(e) => setDdd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Abertura: de / até</Label>
            <div className="flex gap-1">
              <Input className="h-8 text-xs" type="number" value={yearFrom} onChange={(e) => setYearFrom(Number(e.target.value))} />
              <Input className="h-8 text-xs" type="number" value={yearTo} onChange={(e) => setYearTo(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer"><Switch checked={onlyEmail} onCheckedChange={setOnlyEmail} /> Só com e-mail</label>
          <label className="flex items-center gap-1.5 cursor-pointer"><Switch checked={onlyPhone} onCheckedChange={setOnlyPhone} /> Só com telefone</label>
          <label className="flex items-center gap-1.5 cursor-pointer"><Switch checked={onlyHQ} onCheckedChange={setOnlyHQ} /> Só matriz (sem filiais)</label>
        </div>

        <Collapsible className="mt-3">
          <CollapsibleTrigger className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            Filtros avançados (MEI, Simples, capital social) <ChevronDown className="h-3 w-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="grid grid-cols-3 gap-3 mt-2 pt-3 border-t">
            <div className="space-y-1">
              <Label className="text-xs">MEI?</Label>
              <Select value={mei} onValueChange={setMei}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Indiferente</SelectItem>
                  <SelectItem value="yes">Somente MEI</SelectItem>
                  <SelectItem value="no">Excluir MEI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Simples Nacional?</Label>
              <Select value={simples} onValueChange={setSimples}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Indiferente</SelectItem>
                  <SelectItem value="yes">Somente Simples</SelectItem>
                  <SelectItem value="no">Excluir Simples</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Capital social mínimo (R$)</Label>
              <Input className="h-8 text-xs" type="number" value={capitalMin} onChange={(e) => setCapitalMin(e.target.value)} />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            {canSearch ? "Pronto para buscar" : "Informe ao menos 1 CNAE ou 3 letras de razão social"}
          </span>
          <Button onClick={() => searchMut.mutate()} disabled={!canSearch || searchMut.isPending} size="sm">
            {searchMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
            Buscar empresas
          </Button>
        </div>
      </Card>

      {filteredResults && (
        <Card>
          <div className="flex items-center justify-between p-3 border-b">
            <span className="text-sm font-medium">
              {filteredResults.length} resultados {selected.size > 0 && <span className="text-muted-foreground">· {selected.size} selecionados</span>}
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={selected.size === filteredResults.length ? clearSelection : selectAll}>
                {selected.size === filteredResults.length ? "Limpar" : "Selecionar todos"}
              </Button>
              <Button size="sm" onClick={importSelected} disabled={selected.size === 0 || importMut.isPending}>
                {importMut.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                Importar selecionados
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Município</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResults.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleRow(r.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{r.cnpj}</TableCell>
                    <TableCell className="text-xs">
                      <div>{r.razao_social}</div>
                      {r.nome_fantasia && <div className="text-muted-foreground text-[10px]">{r.nome_fantasia}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{r.uf}</TableCell>
                    <TableCell className="text-xs">{r.municipio}</TableCell>
                    <TableCell className="text-xs font-mono">{r.telefone ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.email ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => importOne(r.id)}>
                        + Lead
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredResults.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-6">Nenhuma empresa encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}

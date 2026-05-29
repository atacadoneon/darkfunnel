import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Trash2, Download } from "lucide-react";
import { useStorageSummary, useRecentFiles, useDeleteStorageFile } from "@/features/settings/settingsHooks";
import { useIsAdmin } from "@/features/workspace/permissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];
const PLAN_LIMIT_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB default

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export default function ArmazenamentoPage() {
  const { data: summary } = useStorageSummary();
  const { data: files = [] } = useRecentFiles();
  const del = useDeleteStorageFile();
  const isOwner = useIsAdmin();

  const totalBytes = summary?.total_bytes ?? 0;
  const filesCount = summary?.files_count ?? 0;
  const pct = Math.min(100, (totalBytes / PLAN_LIMIT_BYTES) * 100);

  const pie = useMemo(() => {
    const by = summary?.by_kind ?? {};
    return Object.entries(by).map(([k, v]) => ({ name: k, value: v.bytes }));
  }, [summary]);

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("darkfunnel-media").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Armazenamento</h1>
        <p className="text-sm text-muted-foreground">Acompanhe o consumo de armazenamento de mídias do seu workspace.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total armazenado</p>
          <p className="text-2xl font-bold">{fmtBytes(totalBytes)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Arquivos</p>
          <p className="text-2xl font-bold">{filesCount.toLocaleString("pt-BR")}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Limite do plano</p>
          <p className="text-2xl font-bold">{fmtBytes(PLAN_LIMIT_BYTES)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Uso</p>
          <p className="text-2xl font-bold">{pct.toFixed(1)}%</p>
          <Progress value={pct} className="mt-2 h-2 [&>div]:bg-violet-600" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Por tipo</h3>
          <div className="h-64">
            {pie.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" outerRadius={80} label>
                    {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBytes(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Limpar arquivos órfãos</h3>
            <p className="text-sm text-muted-foreground">Remove arquivos sem referência em mensagens.</p>
          </div>
          <Button variant="outline" disabled={!isOwner} onClick={() => toast.info("Execução agendada em backend.")}>
            Executar limpeza
          </Button>
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b"><h3 className="font-semibold">Arquivos recentes</h3></div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Tamanho</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum arquivo encontrado.</TableCell></TableRow>
            ) : files.map((f) => (
              <TableRow key={f.path}>
                <TableCell className="font-mono text-xs">{f.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{f.mime_type ?? "—"}</TableCell>
                <TableCell className="text-right">{fmtBytes(f.size)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{f.created_at ? new Date(f.created_at).toLocaleString("pt-BR") : "—"}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => downloadFile(f.path)}><Download className="h-4 w-4" /></Button>
                  {isOwner && (
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(f.path)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

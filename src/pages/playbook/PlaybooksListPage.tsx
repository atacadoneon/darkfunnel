import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Plus, Search, MoreVertical, Pencil, Copy, Archive, History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { usePlaybooksList, usePlaybookMutations, CATEGORIES } from "@/features/playbook/hooks";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function PlaybooksListPage() {
  const { data: items = [], isLoading } = usePlaybooksList();
  const { create, duplicate, archive } = usePlaybookMutations();
  const isManager = useIsManagerOrAdmin();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, cat]);

  const handleCreate = async (preset?: { name: string; description: string; category: string }) => {
    const pb = await create.mutateAsync(preset ?? { name: "Novo Playbook" });
    toast.success("Playbook criado");
    navigate(`/playbook/${pb.id}`);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <BookOpen className="h-5 w-5 text-violet-500" />
        <h1 className="text-xl font-semibold">Playbooks</h1>
        <p className="text-sm text-muted-foreground hidden sm:inline">Sequências guiadas para vendas e pós-venda</p>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/playbook/runs"><History className="h-4 w-4 mr-2" /> Execuções</Link>
          </Button>
          {isManager && (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => handleCreate()}>
              <Plus className="h-4 w-4 mr-2" /> Novo Playbook
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar playbook..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-semibold text-lg">Crie seu primeiro playbook</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Padronize sequências de atividades para seus vendedores executarem com previsibilidade.
          </p>
          {isManager && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
              <Card className="p-4 text-left hover:border-violet-500 cursor-pointer transition" onClick={() =>
                handleCreate({ name: "Lead Quente Inbound", description: "Sequência de contato rápido para leads inbound", category: "inbound" })}>
                <div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-violet-500" /><strong className="text-sm">Lead Quente Inbound</strong></div>
                <p className="text-xs text-muted-foreground">Ligação imediata + WhatsApp + tarefa de follow-up</p>
              </Card>
              <Card className="p-4 text-left hover:border-violet-500 cursor-pointer transition" onClick={() =>
                handleCreate({ name: "Pós-venda 7 dias", description: "Acompanhamento pós-fechamento de 7 dias", category: "pos_venda" })}>
                <div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-violet-500" /><strong className="text-sm">Pós-venda 7 dias</strong></div>
                <p className="text-xs text-muted-foreground">Check-ins programados pós-venda</p>
              </Card>
            </div>
          )}
          {isManager && (
            <Button className="mt-6 bg-violet-600 hover:bg-violet-700 text-white" onClick={() => handleCreate()}>
              <Plus className="h-4 w-4 mr-2" /> Novo Playbook em branco
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="p-4 hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/playbook/${p.id}`)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-white"
                    style={{ backgroundColor: p.color ?? "#8b5cf6" }}
                  >
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{p.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{p.description ?? "Sem descrição"}</p>
                  </div>
                </div>
                {isManager && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/playbook/${p.id}`)}><Pencil className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicate.mutate(p, { onSuccess: () => toast.success("Duplicado") })}><Copy className="h-4 w-4 mr-2" /> Duplicar</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => { if (confirm(`Arquivar "${p.name}"?`)) archive.mutate(p.id, { onSuccess: () => toast.success("Arquivado") }); }}
                        ><Archive className="h-4 w-4 mr-2" /> Arquivar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {p.category && <Badge variant="outline" className="text-xs">{p.category}</Badge>}
                <Badge variant={p.is_active ? "default" : "secondary"} className="text-xs">
                  {p.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

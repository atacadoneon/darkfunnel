import { useState } from "react";
import { useLandingPages } from "@/hooks/useLandingPages";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { LandingPageDialog } from "./LandingPageDialog";

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LandingPagesTab() {
  const { data = [], isLoading } = useLandingPages();
  const [openCreate, setOpenCreate] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpenCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova landing page
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>UTM Source</TableHead>
              <TableHead>UTM Campaign</TableHead>
              <TableHead className="text-right">Cliques</TableHead>
              <TableHead className="text-right">Conversas</TableHead>
              <TableHead className="text-right">Conversões</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Taxa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma landing page criada.</TableCell></TableRow>
            ) : data.map((lp) => {
              const conv = lp.clicks_count > 0 ? (lp.conversions_count / lp.clicks_count * 100) : 0;
              return (
                <TableRow key={lp.id}>
                  <TableCell className="font-medium">{lp.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="cursor-pointer gap-1" onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/lp/${lp.slug}`);
                      toast.success("URL copiada");
                    }}>
                      /{lp.slug} <Copy className="h-3 w-3" />
                    </Badge>
                  </TableCell>
                  <TableCell>{lp.utm_source ?? "—"}</TableCell>
                  <TableCell>{lp.utm_campaign ?? "—"}</TableCell>
                  <TableCell className="text-right">{lp.clicks_count}</TableCell>
                  <TableCell className="text-right">{lp.conversations_count}</TableCell>
                  <TableCell className="text-right">{lp.conversions_count}</TableCell>
                  <TableCell className="text-right">{fmtBRL(lp.revenue_cents)}</TableCell>
                  <TableCell className="text-right">{conv.toFixed(1)}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <LandingPageDialog open={openCreate} onClose={() => setOpenCreate(false)} />
    </div>
  );
}

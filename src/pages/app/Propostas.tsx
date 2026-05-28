import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Propostas() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Propostas Comerciais</h1>
        <p className="text-sm text-muted-foreground">
          Kanban de propostas, editor completo e geração de PDF.
        </p>
      </div>
      <Card className="p-12 text-center border-dashed">
        <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">Propostas em construção</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Em breve você poderá criar, editar e enviar propostas comerciais.
        </p>
      </Card>
    </div>
  );
}

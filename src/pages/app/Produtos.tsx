import { Package } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Produtos() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de produtos, categorias e importação do Tiny ERP.
        </p>
      </div>
      <Card className="p-12 text-center border-dashed">
        <Package className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold">Catálogo em construção</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Em breve você poderá cadastrar produtos, categorias e importar do Tiny ERP.
        </p>
      </Card>
    </div>
  );
}

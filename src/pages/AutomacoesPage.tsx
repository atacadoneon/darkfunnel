import { useState } from "react";
import { useParams } from "react-router-dom";
import { Workflow, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AutomacoesSidebar } from "@/components/automacoes/AutomacoesSidebar";
import { CreateFlowDialog } from "@/components/automacoes/CreateFlowDialog";
import { useFlowTemplates } from "@/hooks/useFlowTemplates";

export default function AutomacoesPage() {
  const { id } = useParams();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: templates = [] } = useFlowTemplates();

  return (
    <div className="flex h-[calc(100vh-3rem)]">
      <AutomacoesSidebar activeFlowId={id} onCreateClick={() => setCreateOpen(true)} />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Fluxo de automações</h1>
          </div>

          <Card className="p-8 flex items-center gap-4 bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
            <div className="h-14 w-14 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Plus className="h-7 w-7" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Criar nova automação</h2>
              <p className="text-sm text-muted-foreground">
                Comece em branco, importe um JSON ou use um dos nossos modelos prontos.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nova automação
            </Button>
          </Card>

          {templates.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Modelos prontos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map((t) => (
                  <Card
                    key={t.slug}
                    className="p-4 cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setCreateOpen(true)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Workflow className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{t.name}</div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <CreateFlowDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, ListChecks } from "lucide-react";
import { useIsManagerOrAdmin, useMyRole } from "@/features/workspace/permissions";
import {
  useCustomFieldDefs, useSoftDeleteCustomFieldDef,
  type CustomFieldDefinition, type EntityType,
} from "@/hooks/useCustomFields";
import { FieldDefinitionDialog } from "@/components/customfields/FieldDefinitionDialog";

const ENTITY_TABS: { value: EntityType; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "deal", label: "Negócio" },
  { value: "contact", label: "Contato" },
  { value: "conversation", label: "Conversa" },
];

export default function CustomFieldsSettingsPage() {
  const allowed = useIsManagerOrAdmin();
  const { isLoading } = useMyRole();
  const [entity, setEntity] = useState<EntityType>("lead");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomFieldDefinition | null>(null);
  const { data: defs = [] } = useCustomFieldDefs(entity);
  const del = useSoftDeleteCustomFieldDef();

  if (isLoading) return null;
  if (!allowed) return <Navigate to="/dashboard" replace />;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ListChecks className="h-5 w-5" /> Campos Adicionais
        </h1>
        <p className="text-sm text-muted-foreground">
          Defina campos customizados para Leads, Negócios, Contatos e Conversas.
        </p>
      </div>

      <Tabs value={entity} onValueChange={(v) => setEntity(v as EntityType)}>
        <TabsList className="bg-muted/60">
          {ENTITY_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {ENTITY_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-4 space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => { setEditing(null); setOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo campo
              </Button>
            </div>

            {defs.length === 0 ? (
              <Card className="p-10 text-center border-dashed text-sm text-muted-foreground">
                Nenhum campo definido ainda.
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Nome</th>
                      <th className="text-left px-3 py-2">Slug</th>
                      <th className="text-left px-3 py-2">Tipo</th>
                      <th className="text-left px-3 py-2">Obrigatório</th>
                      <th className="text-left px-3 py-2">Na lista</th>
                      <th className="text-right px-3 py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defs.map((d) => (
                      <tr key={d.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{d.display_name}</td>
                        <td className="px-3 py-2"><code className="text-xs bg-muted px-1 py-0.5 rounded">{d.slug}</code></td>
                        <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{d.field_type}</Badge></td>
                        <td className="px-3 py-2">{d.is_required ? "Sim" : "—"}</td>
                        <td className="px-3 py-2">{d.show_in_list ? "Sim" : "—"}</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => del.mutate(d.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <FieldDefinitionDialog open={open} onOpenChange={setOpen} entityType={entity} editing={editing} />
    </div>
  );
}

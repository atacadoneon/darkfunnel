import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpsertCustomFieldDef, type CustomFieldDefinition, type EntityType, type FieldType } from "@/hooks/useCustomFields";
import { toast } from "sonner";

const TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "currency", label: "Moeda" },
  { value: "date", label: "Data" },
  { value: "datetime", label: "Data/hora" },
  { value: "boolean", label: "Booleano" },
  { value: "select", label: "Seleção" },
  { value: "multi_select", label: "Multi-seleção" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefone" },
  { value: "url", label: "URL" },
  { value: "file", label: "Arquivo" },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function FieldDefinitionDialog({
  open,
  onOpenChange,
  entityType,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: EntityType;
  editing?: CustomFieldDefinition | null;
}) {
  const upsert = useUpsertCustomFieldDef();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [type, setType] = useState<FieldType>("text");
  const [optionsRaw, setOptionsRaw] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");
  const [showInList, setShowInList] = useState(false);
  const [showInDrawer, setShowInDrawer] = useState(true);

  useEffect(() => {
    if (editing) {
      setDisplayName(editing.display_name);
      setSlug(editing.slug);
      setSlugDirty(true);
      setType(editing.field_type);
      setOptionsRaw(editing.options ? JSON.stringify(editing.options, null, 2) : "");
      setIsRequired(editing.is_required);
      setDefaultValue(editing.default_value ? String(editing.default_value) : "");
      setShowInList(editing.show_in_list);
      setShowInDrawer(editing.show_in_drawer);
    } else {
      setDisplayName(""); setSlug(""); setSlugDirty(false); setType("text");
      setOptionsRaw(""); setIsRequired(false); setDefaultValue("");
      setShowInList(false); setShowInDrawer(true);
    }
  }, [editing, open]);

  useEffect(() => {
    if (!slugDirty) setSlug(slugify(displayName));
  }, [displayName, slugDirty]);

  const submit = async () => {
    if (!displayName.trim() || !slug.trim()) return toast.error("Preencha nome e slug");
    let options: any = null;
    if (type === "select" || type === "multi_select") {
      try { options = optionsRaw ? JSON.parse(optionsRaw) : []; }
      catch { return toast.error("JSON de opções inválido"); }
    }
    await upsert.mutateAsync({
      id: editing?.id,
      entity_type: entityType,
      display_name: displayName.trim(),
      slug: slug.trim(),
      field_type: type,
      options,
      is_required: isRequired,
      default_value: defaultValue || null,
      show_in_list: showInList,
      show_in_drawer: showInDrawer,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Editar campo" : "Novo campo"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome de exibição</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugDirty(true); }} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(type === "select" || type === "multi_select") && (
            <div>
              <Label>Opções (JSON array de {`{label, value}`})</Label>
              <Textarea
                rows={4}
                value={optionsRaw}
                onChange={(e) => setOptionsRaw(e.target.value)}
                placeholder='[{"label":"Pequeno","value":"s"},{"label":"Grande","value":"l"}]'
              />
            </div>
          )}
          <div>
            <Label>Valor padrão</Label>
            <Input value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} />
          </div>
          <div className="flex items-center justify-between"><Label>Obrigatório</Label><Switch checked={isRequired} onCheckedChange={setIsRequired} /></div>
          <div className="flex items-center justify-between"><Label>Mostrar na lista</Label><Switch checked={showInList} onCheckedChange={setShowInList} /></div>
          <div className="flex items-center justify-between"><Label>Mostrar no drawer</Label><Switch checked={showInDrawer} onCheckedChange={setShowInDrawer} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={upsert.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

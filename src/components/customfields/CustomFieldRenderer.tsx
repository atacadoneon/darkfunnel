import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  useCustomFieldDefs, useCustomFieldValues, useUpsertCustomFieldValue,
  type CustomFieldDefinition, type EntityType,
} from "@/hooks/useCustomFields";

function FieldInput({ def, value, onCommit }: { def: CustomFieldDefinition; value: any; onCommit: (v: any) => void }) {
  const [local, setLocal] = useState<any>(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);

  const blur = () => { if (local !== (value ?? "")) onCommit(local); };

  switch (def.field_type) {
    case "textarea":
      return <Textarea value={local} onChange={(e) => setLocal(e.target.value)} onBlur={blur} rows={3} />;
    case "number":
    case "currency":
      return <Input type="number" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={blur} />;
    case "date":
      return <Input type="date" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={blur} />;
    case "datetime":
      return <Input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={blur} />;
    case "boolean":
      return <Switch checked={!!local} onCheckedChange={(v) => { setLocal(v); onCommit(v); }} />;
    case "select":
      return (
        <Select value={String(local ?? "")} onValueChange={(v) => { setLocal(v); onCommit(v); }}>
          <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
          <SelectContent>
            {(def.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "email":
      return <Input type="email" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={blur} />;
    case "phone":
      return <Input type="tel" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={blur} />;
    case "url":
      return <Input type="url" value={local} onChange={(e) => setLocal(e.target.value)} onBlur={blur} />;
    default:
      return <Input value={local} onChange={(e) => setLocal(e.target.value)} onBlur={blur} />;
  }
}

export function CustomFieldRenderer({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const { data: defs = [] } = useCustomFieldDefs(entityType, { showInDrawer: true });
  const { data: vals = [] } = useCustomFieldValues(entityType, entityId);
  const upsert = useUpsertCustomFieldValue();

  const valByField = useMemo(() => {
    const m: Record<string, any> = {};
    for (const v of vals) m[v.field_id] = v.value;
    return m;
  }, [vals]);

  if (defs.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <h4 className="text-sm font-semibold">Campos adicionais</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {defs.map((d) => (
          <div key={d.id} className="space-y-1">
            <Label className="text-xs">
              {d.display_name}
              {d.is_required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <FieldInput
              def={d}
              value={valByField[d.id]}
              onCommit={(v) =>
                upsert.mutate({ field_id: d.id, entity_type: entityType, entity_id: entityId, value: v })
              }
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

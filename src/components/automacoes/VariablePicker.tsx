import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useFlowNodes } from "@/hooks/useFlowNodes";
import { cn } from "@/lib/utils";
import { Hash, Type, Calendar, DollarSign, Phone, Mail, ToggleLeft, FileText } from "lucide-react";

type CatVar = {
  id: string;
  category: string;
  slug: string;
  display_name: string;
  data_type: string | null;
  sort_order: number | null;
  is_active: boolean;
};

type CFDef = {
  id: string;
  entity_type: string;
  display_name: string;
  slug: string;
  field_type: string;
};

const CATEGORIES = [
  { key: "lead", label: "Campos do lead" },
  { key: "deal", label: "Campos do negócio" },
  { key: "product", label: "Campos do produto" },
  { key: "conversation", label: "Campos da conversa" },
  { key: "cf_lead", label: "Campos adicionais do lead" },
  { key: "cf_deal", label: "Campos adicionais do negócio" },
  { key: "cf_workspace", label: "Campos adicionais da empresa" },
  { key: "system", label: "Campos do sistema" },
  { key: "ai", label: "Campos de IA" },
  { key: "user_input", label: "Entrada de dados" },
] as const;

type CatKey = typeof CATEGORIES[number]["key"];

function iconFor(type: string | null | undefined) {
  switch (type) {
    case "number":
    case "integer":
      return Hash;
    case "date":
    case "datetime":
      return Calendar;
    case "currency":
    case "money":
      return DollarSign;
    case "phone":
      return Phone;
    case "email":
      return Mail;
    case "boolean":
      return ToggleLeft;
    case "textarea":
      return FileText;
    default:
      return Type;
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (token: string) => void;
  flowId?: string;
  currentNodeId?: string;
};

export function VariablePicker({ open, onClose, onPick, flowId, currentNodeId }: Props) {
  const { current } = useWorkspace();
  const [active, setActive] = useState<CatKey>("lead");
  const [search, setSearch] = useState("");

  const catalogQ = useQuery({
    queryKey: ["flow_variable_catalog"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flow_variable_catalog" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CatVar[];
    },
  });

  const cfQ = useQuery({
    queryKey: ["custom_field_definitions_picker", current?.id],
    enabled: open && !!current,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_field_definitions" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .is("deleted_at", null)
        .in("entity_type", ["lead", "deal", "workspace"]);
      if (error) throw error;
      return (data ?? []) as unknown as CFDef[];
    },
  });

  const { nodes } = useFlowNodes(flowId);

  const dynamicVars = useMemo(() => {
    const ai: { slug: string; display_name: string; data_type: string }[] = [];
    const inputs: { slug: string; display_name: string; data_type: string }[] = [];
    for (const n of nodes) {
      if (currentNodeId && n.id === currentNodeId) continue;
      if (n.node_type === "ai" && n.config?.response_var) {
        ai.push({ slug: n.config.response_var, display_name: n.config.response_var, data_type: "text" });
      }
      if (n.node_type === "message" && Array.isArray(n.config?.subblocks)) {
        for (const sb of n.config.subblocks) {
          if (sb.subtype === "user_input" && sb.user_input_var) {
            inputs.push({ slug: sb.user_input_var, display_name: sb.user_input_var, data_type: "text" });
          }
        }
      }
    }
    return { ai, inputs };
  }, [nodes, currentNodeId]);

  const items = useMemo(() => {
    const catalog = catalogQ.data ?? [];
    const cf = cfQ.data ?? [];
    let list: { slug: string; display_name: string; data_type: string | null; token: string }[] = [];
    if (active === "lead" || active === "deal" || active === "product" || active === "conversation" || active === "system") {
      list = catalog
        .filter((c) => c.category === active)
        .map((c) => ({ slug: c.slug, display_name: c.display_name, data_type: c.data_type, token: `{{${c.category}.${c.slug}}}` }));
    } else if (active === "cf_lead") {
      list = cf.filter((c) => c.entity_type === "lead").map((c) => ({ slug: c.slug, display_name: c.display_name, data_type: c.field_type, token: `{{cf.lead.${c.slug}}}` }));
    } else if (active === "cf_deal") {
      list = cf.filter((c) => c.entity_type === "deal").map((c) => ({ slug: c.slug, display_name: c.display_name, data_type: c.field_type, token: `{{cf.deal.${c.slug}}}` }));
    } else if (active === "cf_workspace") {
      list = cf.filter((c) => c.entity_type === "workspace").map((c) => ({ slug: c.slug, display_name: c.display_name, data_type: c.field_type, token: `{{cf.workspace.${c.slug}}}` }));
    } else if (active === "ai") {
      list = dynamicVars.ai.map((c) => ({ slug: c.slug, display_name: c.display_name, data_type: c.data_type, token: `{{ai.${c.slug}}}` }));
    } else if (active === "user_input") {
      list = dynamicVars.inputs.map((c) => ({ slug: c.slug, display_name: c.display_name, data_type: c.data_type, token: `{{input.${c.slug}}}` }));
    }
    const s = search.trim().toLowerCase();
    if (s) list = list.filter((v) => v.display_name.toLowerCase().includes(s) || v.slug.toLowerCase().includes(s));
    return list;
  }, [active, catalogQ.data, cfQ.data, dynamicVars, search]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b">
          <DialogTitle className="text-base">Pesquisar variável</DialogTitle>
        </DialogHeader>
        <div className="p-3 border-b">
          <Input placeholder="Buscar variável..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex h-[420px]">
          <aside className="w-[220px] border-r overflow-y-auto p-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setActive(c.key)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted",
                  active === c.key && "bg-muted font-medium",
                )}
              >
                {c.label}
              </button>
            ))}
          </aside>
          <main className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground col-span-2 p-4">Nenhuma variável.</p>
            ) : (
              items.map((v) => {
                const Icon = iconFor(v.data_type);
                return (
                  <button
                    key={v.slug + v.token}
                    onClick={() => {
                      onPick(v.token);
                      onClose();
                    }}
                    className="flex items-center gap-2 px-3 py-2 border rounded-md hover:border-primary hover:bg-muted/50 text-left"
                  >
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{v.display_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate font-mono">{v.token}</p>
                    </div>
                  </button>
                );
              })
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}

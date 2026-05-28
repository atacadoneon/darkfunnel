import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  MessageSquare, Zap, GitBranch, Clock, Shuffle, Globe, FormInput,
  Sparkles, Code, Pencil, Trash2, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NodeCounters } from "../NodeCounters";

const ICONS: Record<string, LucideIcon> = {
  message: MessageSquare,
  action: Zap,
  condition: GitBranch,
  wait: Clock,
  random: Shuffle,
  api: Globe,
  fields: FormInput,
  ai: Sparkles,
  javascript: Code,
};

const LABELS: Record<string, string> = {
  message: "Mensagem",
  action: "Ação",
  condition: "Condição",
  wait: "Espera",
  random: "Randomizador",
  api: "API",
  fields: "Operações de campos",
  ai: "IA",
  javascript: "JavaScript",
};

function summarize(type: string, config: any): string {
  if (!config) return "Configurar...";
  switch (type) {
    case "message":
      return (config.text as string)?.slice(0, 80) || "Sem mensagem";
    case "wait":
      return `${config.amount ?? 0} ${config.unit ?? "minutos"}`;
    case "condition":
      return `${(config.conditions?.length ?? 0)} condição(ões)`;
    case "random":
      return `${(config.variants?.length ?? 0)} variante(s)`;
    case "action":
      return config.action_type ?? "Configurar ação";
    case "api":
      return `${config.method ?? "GET"} ${config.url ?? "—"}`.slice(0, 60);
    case "fields":
      return `${config.operation ?? "set"} ${config.field_path ?? ""}`.slice(0, 60);
    case "ai":
      return (config.prompt as string)?.slice(0, 80) || "Configurar prompt";
    case "javascript":
      return "Código JavaScript";
    default:
      return "—";
  }
}

export function GenericNode({ id, data, type }: NodeProps) {
  const d: any = data ?? {};
  const nodeType = (d.node_type ?? type) as string;
  const Icon = ICONS[nodeType] ?? Zap;
  const label = LABELS[nodeType] ?? nodeType;

  const sourceHandles: { id: string; label?: string; top: string }[] = (() => {
    if (nodeType === "condition") {
      return [
        { id: "true", label: "Sim", top: "30%" },
        { id: "false", label: "Não", top: "70%" },
      ];
    }
    if (nodeType === "random") {
      const variants = d.config?.variants ?? [];
      if (!variants.length) return [{ id: "default", top: "50%" }];
      return variants.map((v: any, i: number) => ({
        id: v.id ?? `variant_${i}`,
        label: v.label ?? `Variante ${i + 1}`,
        top: `${((i + 1) / (variants.length + 1)) * 100}%`,
      }));
    }
    return [{ id: "default", top: "50%" }];
  })();

  return (
    <div className="w-[280px] rounded-lg border bg-card shadow-md relative">
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <div className="h-7 w-7 rounded bg-muted text-foreground flex items-center justify-center">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold flex-1 truncate">{label}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            d.onEdit?.();
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            d.onDelete?.();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="p-3 space-y-1">
        <p className="text-xs text-muted-foreground line-clamp-2 leading-snug min-h-[2rem]">
          {summarize(nodeType, d.config)}
        </p>
        <NodeCounters success={d.success_count} warning={d.warning_count} error={d.error_count} />
      </div>

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-muted-foreground" />
      {sourceHandles.map((h) => (
        <div key={h.id} style={{ position: "absolute", right: -6, top: h.top, transform: "translateY(-50%)" }}>
          <Handle
            type="source"
            position={Position.Right}
            id={h.id}
            style={{ position: "relative", transform: "none", right: 0, top: 0 }}
            className="!w-3 !h-3 !bg-primary"
          />
          {h.label && sourceHandles.length > 1 && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
              {h.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export const MessageNode = memo(GenericNode);
export const ActionNode = memo(GenericNode);
export const ConditionNode = memo(GenericNode);
export const WaitNode = memo(GenericNode);
export const RandomNode = memo(GenericNode);
export const ApiNode = memo(GenericNode);
export const FieldsNode = memo(GenericNode);
export const AiNode = memo(GenericNode);
export const JavascriptNode = memo(GenericNode);

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
    case "message": {
      const sbs = config.subblocks ?? [];
      const firstText = sbs.find((s: any) => s.subtype === "text");
      if (firstText?.text) return firstText.text.slice(0, 80);
      if (sbs.length) return `${sbs.length} sub-bloco(s)`;
      if (config.text) return String(config.text).slice(0, 80);
      return "Sem mensagem";
    }
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

type SrcHandle = {
  id: string;
  label?: string;
  color?: "primary" | "destructive" | "muted";
};

export function GenericNode({ data, type }: NodeProps) {
  const d: any = data ?? {};
  const nodeType = (d.node_type ?? type) as string;
  const Icon = ICONS[nodeType] ?? Zap;
  const label = LABELS[nodeType] ?? nodeType;
  const cfg = d.config ?? {};

  const sourceHandles: SrcHandle[] = (() => {
    if (nodeType === "condition") {
      return [
        { id: "true", label: "Sim", color: "primary" },
        { id: "false", label: "Não", color: "destructive" },
      ];
    }
    if (nodeType === "random") {
      const variants = cfg.variants ?? [];
      if (!variants.length) return [{ id: "default", color: "primary" }];
      return variants.map((v: any, i: number) => ({
        id: v.id ?? `variant_${i}`,
        label: v.label ?? `Variante ${i + 1}`,
        color: "primary",
      }));
    }
    if (nodeType === "message") {
      const hs: SrcHandle[] = [{ id: "next", label: "Próximo passo", color: "primary" }];
      const buttons: { id: string; title: string }[] = [];
      for (const sb of cfg.subblocks ?? []) {
        if (sb.subtype === "text" && Array.isArray(sb.buttons)) {
          for (const b of sb.buttons) buttons.push(b);
        }
      }
      for (const b of buttons) {
        hs.push({ id: `button:${b.id}`, label: b.title || "Botão", color: "muted" });
      }
      if (cfg.on_error_handle === "enabled") {
        hs.push({ id: "error", label: "Caso ocorrer erro no envio", color: "destructive" });
      }
      return hs;
    }
    return [{ id: "default", color: "primary" }];
  })();

  const colorCls = (c: SrcHandle["color"]) =>
    c === "destructive" ? "!bg-destructive" : c === "muted" ? "!bg-muted-foreground" : "!bg-primary";

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
          onClick={(e) => { e.stopPropagation(); d.onEdit?.(); }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-destructive"
          onClick={(e) => { e.stopPropagation(); d.onDelete?.(); }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="p-3 space-y-1">
        <p className="text-xs text-muted-foreground line-clamp-2 leading-snug min-h-[2rem]">
          {summarize(nodeType, cfg)}
        </p>
        <NodeCounters success={d.success_count} warning={d.warning_count} error={d.error_count} />
      </div>

      {/* Handle labels for message node (always rendered, low cost) */}
      {nodeType === "message" && sourceHandles.length > 1 && (
        <div className="px-3 pb-2 space-y-0.5">
          {sourceHandles.map((h) => (
            <div
              key={h.id}
              className={
                "text-[10px] flex items-center justify-end gap-1 " +
                (h.color === "destructive" ? "text-destructive" : "text-muted-foreground")
              }
            >
              <span className="truncate">{h.label}</span>
              <span
                className={
                  "h-1.5 w-1.5 rounded-full " +
                  (h.color === "destructive" ? "bg-destructive" : h.color === "muted" ? "bg-muted-foreground" : "bg-primary")
                }
              />
            </div>
          ))}
        </div>
      )}

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-muted-foreground" />
      {sourceHandles.map((h, i) => {
        const top = `${((i + 1) / (sourceHandles.length + 1)) * 100}%`;
        return (
          <div key={h.id} style={{ position: "absolute", right: -6, top, transform: "translateY(-50%)" }}>
            <Handle
              type="source"
              position={Position.Right}
              id={h.id}
              style={{ position: "relative", transform: "none", right: 0, top: 0 }}
              className={"!w-3 !h-3 " + colorCls(h.color)}
            />
            {h.label && sourceHandles.length > 1 && nodeType !== "message" && (
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                {h.label}
              </span>
            )}
          </div>
        );
      })}
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

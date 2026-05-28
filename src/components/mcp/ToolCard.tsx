import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { McpTool } from "@/hooks/useMcpCatalog";

const RISK_LABEL: Record<string, string> = { low: "Baixo", medium: "Médio", high: "Alto" };
const RISK_CLS: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  high: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
};

export function ToolCard({ tool, enabled, onToggle }: { tool: McpTool; enabled: boolean; onToggle: (v: boolean) => void }) {
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{tool.display_name}</span>
            <Badge variant="outline" className={`text-[10px] ${RISK_CLS[tool.risk_level] ?? ""}`}>
              {RISK_LABEL[tool.risk_level] ?? tool.risk_level}
            </Badge>
            {tool.is_destructive && (
              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30">
                destrutiva
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
          <code className="text-[10px] text-muted-foreground/70">{tool.slug}</code>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
    </Card>
  );
}

import { MessageSquare, Zap, GitBranch, Clock, Shuffle, Globe, FormInput, Sparkles, Code, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  message: MessageSquare, action: Zap, condition: GitBranch, wait: Clock,
  random: Shuffle, api: Globe, fields: FormInput, ai: Sparkles, javascript: Code,
};

const BLOCKS: { slug: string; label: string }[] = [
  { slug: "message", label: "Mensagem" },
  { slug: "action", label: "Ações" },
  { slug: "condition", label: "Condições" },
  { slug: "wait", label: "Espera" },
  { slug: "random", label: "Randomizador" },
  { slug: "api", label: "API" },
  { slug: "fields", label: "Op. de campos" },
  { slug: "ai", label: "IA" },
  { slug: "javascript", label: "JavaScript" },
];

export function BlocksSidebar() {
  return (
    <aside className="w-[200px] shrink-0 border-l bg-card/50 p-3 overflow-y-auto">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        Blocos básicos
      </h3>
      <div className="space-y-2">
        {BLOCKS.map((b) => {
          const Icon = ICONS[b.slug] ?? Zap;
          return (
            <div
              key={b.slug}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/flow-block", b.slug);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="flex items-center gap-2 p-2 rounded-md border bg-background hover:border-primary hover:shadow-sm cursor-grab active:cursor-grabbing text-sm"
            >
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{b.label}</span>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

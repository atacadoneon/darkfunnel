import { ReactNode } from "react";
import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export type StepDef = { id: number; title: string };

export function CompanyWizardShell({
  sidebarTitle,
  sidebarSubtitle,
  steps,
  currentStep,
  stepTitle,
  stepSubtitle,
  children,
  footer,
  rightLabel,
}: {
  sidebarTitle: string;
  sidebarSubtitle: string;
  steps: StepDef[];
  currentStep: number;
  stepTitle: string;
  stepSubtitle: string;
  children: ReactNode;
  footer: ReactNode;
  rightLabel?: string;
}) {
  const total = steps.length;
  const pct = Math.round((currentStep / total) * 100);
  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside className="w-[320px] shrink-0 border-r bg-background flex flex-col p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{sidebarTitle}</h1>
          <p className="text-sm text-muted-foreground">{sidebarSubtitle}</p>
        </div>
        <ol className="mt-10 space-y-4 flex-1">
          {steps.map((s) => {
            const done = s.id < currentStep;
            const active = s.id === currentStep;
            return (
              <li key={s.id} className="flex items-center gap-3">
                <span
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border ${
                    done
                      ? "bg-primary text-primary-foreground border-primary"
                      : active
                      ? "bg-primary/10 text-primary border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : s.id}
                </span>
                <span className={`text-sm ${active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.title}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-[11px] text-muted-foreground mt-8">© {new Date().getFullYear()} DarkSales</p>
      </aside>

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl bg-background border rounded-xl shadow-sm p-8 space-y-6">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-bold tracking-tight">{stepTitle}</h2>
            <span className="text-xs text-muted-foreground">{rightLabel ?? `${currentStep}/${total}`}</span>
          </div>
          <Progress value={pct} className="h-1.5" />
          <p className="text-sm text-muted-foreground">{stepSubtitle}</p>
          <div className="pt-2">{children}</div>
          <div className="pt-4 border-t flex items-center justify-end gap-2">{footer}</div>
        </div>
      </main>
    </div>
  );
}

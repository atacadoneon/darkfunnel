import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Facebook, Globe, Target } from "lucide-react";
import { OverviewTab } from "./OverviewTab";
import { MetaAdsTab } from "./MetaAdsTab";
import { GoogleAdsTab } from "./GoogleAdsTab";
import { LandingPagesTab } from "./LandingPagesTab";

const SUB = [
  { value: "overview", label: "Visão geral", icon: BarChart3 },
  { value: "meta", label: "Meta Ads", icon: Facebook },
  { value: "google", label: "Google Ads", icon: Globe },
  { value: "landing", label: "Landing Pages", icon: Target },
] as const;

export function TrackingSection() {
  const [params, setParams] = useSearchParams();
  const sub = params.get("sub") ?? "overview";

  return (
    <Tabs
      value={sub}
      onValueChange={(v) => {
        const next = new URLSearchParams(params);
        next.set("sub", v);
        setParams(next, { replace: true });
      }}
    >
      <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
        {SUB.map((t) => (
          <TabsTrigger key={t.value} value={t.value} className="gap-2">
            <t.icon className="h-4 w-4" />
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="overview" className="mt-6"><OverviewTab /></TabsContent>
      <TabsContent value="meta" className="mt-6"><MetaAdsTab /></TabsContent>
      <TabsContent value="google" className="mt-6"><GoogleAdsTab /></TabsContent>
      <TabsContent value="landing" className="mt-6"><LandingPagesTab /></TabsContent>
    </Tabs>
  );
}

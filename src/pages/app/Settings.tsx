import { Navigate, useSearchParams, NavLink } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { PreferencesSection } from "@/features/settings/PreferencesSection";
import { ChannelsSection } from "@/features/channels/ChannelsSection";
import { TagsAdminSection, LossReasonsAdminSection } from "@/features/workspace/CatalogsAdmin";
import { UsersSection } from "@/features/workspace/UsersSection";
import { useIsManagerOrAdmin, useMyRole } from "@/features/workspace/permissions";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import RodizioSection from "@/pages/SettingsRodizio";
import { TrackingSection } from "@/features/tracking/TrackingSection";
import { GatewaysSection } from "@/features/payments/GatewaysSection";
import { Settings2, Radio, LineChart, Plug, Users, Tags, Shield, ArrowUpRight, Shuffle } from "lucide-react";

const BASE_TABS = [
  { value: "preferences",  label: "Preferências", icon: Settings2 },
  { value: "channels",     label: "Canais",       icon: Radio },
  { value: "rodizio",      label: "Rodízio",      icon: Shuffle },
  { value: "catalogs",     label: "Cadastros",    icon: Tags },
  { value: "tracking",     label: "Trackeamento", icon: LineChart },
  { value: "integrations", label: "Integrações",  icon: Plug },
  { value: "users",        label: "Usuários",     icon: Users },
] as const;

function Empty({ title, desc }: { title: string; desc: string }) {
  return (
    <Card className="p-10 text-center border-dashed">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </Card>
  );
}

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "preferences";
  const allowed = useIsManagerOrAdmin();
  const { isLoading } = useMyRole();
  const { data: isPlatformAdmin } = usePlatformAdmin();
  if (isLoading) return null;
  if (!allowed) return <Navigate to="/dashboard" replace />;

  const tabs = isPlatformAdmin
    ? [...BASE_TABS, { value: "platform", label: "Plataforma", icon: Shield } as const]
    : BASE_TABS;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie preferências, canais, trackeamento, integrações e usuários.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params);
          next.set("tab", v);
          setParams(next, { replace: true });
        }}
      >
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="preferences" className="mt-6">
          <PreferencesSection />
        </TabsContent>
        <TabsContent value="channels" className="mt-6">
          <ChannelsSection />
        </TabsContent>
        <TabsContent value="rodizio" className="mt-6">
          <RodizioSection />
        </TabsContent>
        <TabsContent value="catalogs" className="mt-6 space-y-6">
          <TagsAdminSection />
          <LossReasonsAdminSection />
        </TabsContent>
        <TabsContent value="tracking" className="mt-6">
          <TrackingSection />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <GatewaysSection />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UsersSection />
        </TabsContent>
        {isPlatformAdmin && (
          <TabsContent value="platform" className="mt-6">
            <Card className="p-6 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Admin da Plataforma
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Gerencie workspaces, uso, logs de auditoria e feature flags.
                </p>
              </div>
              <NavLink
                to="/admin"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90"
              >
                Abrir painel <ArrowUpRight className="h-3.5 w-3.5" />
              </NavLink>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}


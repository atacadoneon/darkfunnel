import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { ChannelsSection } from "@/features/channels/ChannelsSection";
import { TagsAdminSection, LossReasonsAdminSection } from "@/features/workspace/CatalogsAdmin";
import { Settings2, Radio, LineChart, Plug, Users, Tags } from "lucide-react";

const TABS = [
  { value: "preferences",  label: "Preferências", icon: Settings2 },
  { value: "channels",     label: "Canais",       icon: Radio },
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

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie preferências, canais, trackeamento, integrações e usuários do workspace.
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
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-2">
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="preferences" className="mt-6">
          <Empty title="Preferências" desc="Idioma, fuso horário, notificações e tema do workspace — em breve." />
        </TabsContent>
        <TabsContent value="channels" className="mt-6">
          <ChannelsSection />
        </TabsContent>
        <TabsContent value="tracking" className="mt-6">
          <Empty title="Trackeamento" desc="Pixel, UTMs, eventos de conversão e webhooks de tracking — em breve." />
        </TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <Empty title="Integrações" desc="Conecte ferramentas externas (CRM, e-commerce, automações) — em breve." />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <Empty title="Usuários" desc="Convide membros, gerencie papéis e permissões — em breve." />
        </TabsContent>
      </Tabs>
    </div>
  );
}

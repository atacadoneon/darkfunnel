import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  MessageCircle,
  Mail,
  Target,
  ListChecks,
  Calendar,
  ClipboardList,
  MessageSquare,
  Workflow,
  Settings,
  HelpCircle,
  ArrowLeft,
  LifeBuoy,
  UserCheck,
  Building2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";
import { cn } from "@/lib/utils";

type Item = { title: string; url: string; icon: any };

const sections: { label: string; items: Item[] }[] = [
  {
    label: "Principal",
    items: [
      { title: "Dashboard", url: "/app/dashboard", icon: LayoutGrid },
      { title: "CRM & Leads", url: "/app/pipeline", icon: Users },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { title: "WhatsApp", url: "/app/inbox", icon: MessageCircle },
      { title: "Email Marketing", url: "/app/email", icon: Mail },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Metas", url: "/app/goals", icon: Target },
      { title: "Tarefas", url: "/app/tasks", icon: ListChecks },
      { title: "Reuniões", url: "/app/meetings", icon: Calendar },
      { title: "Quiz", url: "/app/quiz", icon: ClipboardList },
    ],
  },
  {
    label: "Automação",
    items: [
      { title: "Fluxo de Cadência", url: "/app/cadence", icon: MessageSquare },
      { title: "Automações", url: "/app/automations", icon: Workflow },
    ],
  },
  {
    label: "Ferramentas",
    items: [{ title: "Configurações", url: "/app/settings", icon: Settings }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { current } = useWorkspace();
  const { user } = useAuth();
  const canSeeSettings = useIsManagerOrAdmin();

  const visibleSections = sections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => canSeeSettings || i.url !== "/app/settings"),
    }))
    .filter((s) => s.items.length > 0);

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Usuário";

  const wsName = current?.name ?? "Workspace";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3 border-b">
        {collapsed ? (
          <div className="h-8 w-8 mx-auto rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold">
            {wsName.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center font-semibold">
                {wsName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{wsName}</div>
              </div>
            </div>

            <button
              className="w-full flex items-center gap-2 rounded-md border bg-background/40 px-3 py-2 text-sm hover:bg-muted transition-colors"
              type="button"
            >
              <Building2 className="h-4 w-4" />
              <span className="truncate">{wsName}</span>
            </button>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Usuário: <span className="text-foreground">{userName}</span>
              </p>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
              >
                <Users className="h-4 w-4" />
                Equipe Online
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-emerald-500 hover:bg-muted transition-colors"
              >
                <UserCheck className="h-4 w-4" />
                Disponível
              </button>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
                      <NavLink to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-2 space-y-2">
        {!collapsed ? (
          <>
            <button
              type="button"
              className="w-full relative flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <span className="relative">
                <HelpCircle className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Ajuda
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Painel do Parceiro
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LifeBuoy className="h-4 w-4" />
              Suporte
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <button className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-muted" aria-label="Ajuda">
              <HelpCircle className="h-4 w-4" />
            </button>
            <button className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-muted" aria-label="Suporte">
              <LifeBuoy className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

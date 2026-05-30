import { NavLink, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  type LucideIcon,
  LayoutGrid,
  Users,
  Filter,
  MessageCircle,
  Mail,
  Target,
  ListChecks,
  CalendarDays,
  MessageSquare,
  Workflow,
  Settings,
  HelpCircle,
  LifeBuoy,
  Search,
  Pin,
  PinOff,
  PhoneOutgoing,
  CreditCard,
  Package,
  FileText,
  Zap,
  FolderPlus,
  BookOpen,
  Shuffle,
  Tag,
  List as ListIcon,
  X as XIcon,
  CalendarCheck,
  Building2,
  BarChart3,
  FolderTree,
  Clock,
  Plug,
  Wifi,
  Server,
  Webhook,
  Database,
  Shield,
  PlusCircle,
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
import { useMyRole, type WorkspaceRole } from "@/features/workspace/permissions";
import { cn } from "@/lib/utils";
import logoDarkFunnel from "@/assets/darkfunnel-logo.png";
import { useSidebarState, type SubmenuId } from "@/contexts/SidebarContext";
import { SubmenuPanel, type SubmenuItem } from "@/components/layout/SubmenuPanel";

type Item = { title: string; url: string; icon: LucideIcon; roles?: WorkspaceRole[] };

const sections: { label: string; items: Item[] }[] = [
  {
    label: "",
    items: [
      { title: "CRM", url: "/funildevendas", icon: Filter },
      { title: "Leads", url: "/leads", icon: Users },
      { title: "WhatsApp", url: "/chats", icon: MessageCircle },
      { title: "Discador", url: "/discador", icon: PhoneOutgoing },
      { title: "Produtos", url: "/produtos", icon: Package },
      { title: "Propostas", url: "/propostas", icon: FileText },
      { title: "Pagamentos", url: "/pagamentos", icon: CreditCard },
    ],
  },
  {
    label: "Organização",
    items: [
      { title: "Agenda e Reuniões", url: "/agenda", icon: CalendarDays },
      { title: "Tarefas", url: "/tarefas", icon: ListChecks },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutGrid },
      { title: "Metas", url: "/metas", icon: Target },
      { title: "Prospecção", url: "/prospeccao", icon: Search },
    ],
  },
];

type FooterSubItem = SubmenuItem & { roles?: WorkspaceRole[] };
type FooterMenu = { key: SubmenuId; label: string; icon: LucideIcon; items: FooterSubItem[] };

const footerMenus: FooterMenu[] = [
  {
    key: "automacoes",
    label: "Automações",
    icon: Zap,
    items: [
      { label: "Automação", to: "/automacoes", icon: Workflow },
      { label: "Email Marketing", to: "/emailmarketing", icon: Mail },
      { label: "Fluxo de Cadência", to: "/cadencia", icon: MessageSquare },
      { label: "Playbook", to: "/playbook", icon: BookOpen },
      { label: "Trackeamento", to: "/trackeamento", icon: Target },
      { label: "Rodízio de Leads", to: "/settings/rodizio", icon: Shuffle, roles: ["proprietario", "gerente"] },
    ],
  },
  {
    key: "cadastros",
    label: "Cadastros",
    icon: FolderPlus,
    items: [
      { label: "Listas", to: "/settings/listas", icon: ListIcon },
      { label: "Motivos de Perda", to: "/settings/motivos-perda", icon: XIcon },
      { label: "Tipo de Atividade", to: "/settings/tipos-atividade", icon: CalendarCheck },
      { label: "Tags", to: "/settings/tags", icon: Tag },
      { label: "Tags de Produto", to: "/settings/tags-produto", icon: Tag },
    ],
  },
  {
    key: "configuracoes",
    label: "Configurações",
    icon: Settings,
    items: [
      { label: "Empresa", to: "/settings/empresa", icon: Building2 },
      { label: "Planos e uso", to: "/settings/planos", icon: BarChart3 },
      { label: "Usuários", to: "/settings/usuarios", icon: Users },
      { label: "Departamentos", to: "/settings/departamentos", icon: FolderTree },
      { label: "Horários de trabalho", to: "/settings/horarios", icon: Clock },
      { label: "Integrações", to: "/settings/integracoes", icon: Plug },
      { label: "Conexões", to: "/settings/canais", icon: Wifi },
      { label: "Servidor MCP", to: "/config/mcp-server", icon: Server, roles: ["proprietario", "gerente"] },
      { label: "Webhook de Entrada", to: "/config/inbound-webhooks", icon: Webhook, roles: ["proprietario", "gerente"] },
      { label: "Armazenamento", to: "/settings/armazenamento", icon: Database },
      { label: "Campos adicionais", to: "/config/custom-fields", icon: PlusCircle, roles: ["proprietario", "gerente"] },
      { label: "Administração", to: "/admin", icon: Shield, roles: ["proprietario", "platform_admin"] },
    ],
  },
];

export function AppSidebar() {
  const { state, setOpen } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { current } = useWorkspace();
  const { user } = useAuth();
  const { data: role } = useMyRole();

  const {
    openSubmenu,
    toggleSubmenu,
    pinnedSubmenus,
  } = useSidebarState();


  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Usuário";

  const wsName = current?.name ?? "Conta";

  const filterByRole = <T extends { roles?: WorkspaceRole[] }>(items: T[]) =>
    items.filter((it) => !it.roles || (role && it.roles.includes(role)));


  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar" side="left" className="h-svh">
        <SidebarHeader className="p-2 border-b">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <img src={logoDarkFunnel} alt="DarkFunnel" className="h-8 w-8 object-contain" loading="lazy" width={32} height={32} />
              <NavLink
                to="/equipe-online"
                className="h-8 w-8 rounded-md flex items-center justify-center bg-background/40 border text-xs font-semibold hover:bg-muted text-foreground/80 hover:text-foreground transition-colors uppercase"
                title={wsName}
              >
                {wsName.charAt(0)}
              </NavLink>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <img
                  src={logoDarkFunnel}
                  alt="DarkFunnel"
                  className="h-8 w-8 shrink-0 object-contain"
                  loading="lazy"
                  width={32}
                  height={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">DarkFunnel</div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-md border bg-background/40 px-2 py-1.5 text-sm">
                <span className="truncate flex-1 text-xs">{wsName}</span>
                <NavLink
                  to="/equipe-online"
                  className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  title="Equipe Online"
                >
                  <Users className="h-3.5 w-3.5" />
                </NavLink>
              </div>
            </div>
          )}
        </SidebarHeader>



        <SidebarContent className="gap-0 overflow-y-auto">
          {sections.map((section) => (
            <SidebarGroup key={section.label || "main"} className="py-1">
              {section.label && (
                collapsed ? (
                  <div className="h-8 flex items-center justify-center text-sidebar-foreground/40 text-xs select-none" aria-hidden>
                    —
                  </div>
                ) : (
                  <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                )
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
                        <NavLink
                          to={item.url}
                          className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                        >
                          <item.icon className="h-5 w-5" />
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

        <SidebarFooter className="border-t p-2 gap-2">
          <SidebarMenu>
            {footerMenus.map((menu) => {
              const visibleItems = filterByRole(menu.items);
              if (visibleItems.length === 0) return null;
              const isActive = visibleItems.some((it) => pathname.startsWith(it.to));
              const isOpen = openSubmenu === menu.key || !!pinnedSubmenus[menu.key];
              return (
                <SidebarMenuItem key={menu.key}>
                  <SidebarMenuButton
                    isActive={isActive || isOpen}
                    onClick={() => toggleSubmenu(menu.key)}
                    className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                  >
                    <menu.icon className="h-5 w-5" />
                    {!collapsed && <span>{menu.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>

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
              <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                <button
                  type="button"
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  <LifeBuoy className="h-3.5 w-3.5" />
                  Suporte
                </button>
                <span className="truncate">{userName}</span>
              </div>
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

      {footerMenus.map((menu) => {
        const visibleItems = filterByRole(menu.items);
        if (visibleItems.length === 0) return null;
        return (
          <SubmenuPanel
            key={menu.key}
            id={menu.key}
            title={menu.label}
            items={visibleItems.map(({ label, to, icon }) => ({ label, to, icon }))}
            overlay={openSubmenu === menu.key && !pinnedSubmenus[menu.key]}
          />
        );
      })}
    </>
  );
}

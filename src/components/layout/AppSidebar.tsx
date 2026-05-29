import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
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
  ArrowLeft,
  LifeBuoy,
  LogOut,
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
  User as UserIcon,
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
  ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { useMyRole, type WorkspaceRole } from "@/features/workspace/permissions";
import { cn } from "@/lib/utils";
import logoDarkFunnel from "@/assets/darkfunnel-logo.png";

type Item = { title: string; url: string; icon: LucideIcon; roles?: WorkspaceRole[] };

const sections: { label: string; items: Item[] }[] = [
  {
    label: "",
    items: [
      { title: "CRM & Leads", url: "/funildevendas", icon: Filter },
      { title: "WhatsApp", url: "/chats", icon: MessageCircle },
      { title: "Discador", url: "/discador", icon: PhoneOutgoing },
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

type SubItem = { label: string; to: string; icon: LucideIcon; roles?: WorkspaceRole[] };
type FooterMenu = { key: string; label: string; icon: LucideIcon; items: SubItem[] };

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
      { label: "Produtos", to: "/produtos", icon: Package },
      { label: "Listas", to: "/settings/listas", icon: ListIcon },
      { label: "Motivos de Perda", to: "/settings/motivos-perda", icon: XIcon },
      { label: "Tipo de Atividade", to: "/settings/tipos-atividade", icon: CalendarCheck },
      { label: "Tags", to: "/settings/tags", icon: Tag },
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

type AppSidebarProps = {
  pinned?: boolean;
  onTogglePin?: () => void;
};

const HOVER_OPEN_DELAY_MS = 2000;

export function AppSidebar({ pinned = false, onTogglePin }: AppSidebarProps = {}) {
  const { state, setOpen } = useSidebar();
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { current } = useWorkspace();
  const { user } = useAuth();
  const { data: role } = useMyRole();
  const navigate = useNavigate();

  const [available, setAvailable] = useState<boolean>(() => {
    return (localStorage.getItem("presence:manual") ?? "online") !== "away";
  });

  const toggleAvailable = () => {
    const next = !available;
    setAvailable(next);
    localStorage.setItem("presence:manual", next ? "online" : "away");
    window.dispatchEvent(new Event("presence:manual-change"));
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Erro ao sair");
      return;
    }
    navigate("/login", { replace: true });
  };

  const handleMouseEnter = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    setOpen(false);
  };

  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
    },
    [],
  );

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Usuário";

  const wsName = current?.name ?? "Conta";

  const filterByRole = (items: SubItem[]) =>
    items.filter((it) => !it.roles || (role && it.roles.includes(role)));

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="h-svh" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <SidebarHeader className="p-3 border-b">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <img src={logoDarkFunnel} alt="DarkFunnel" className="h-8 w-8 object-contain" loading="lazy" width={32} height={32} />
            <button
              type="button"
              onClick={toggleAvailable}
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-colors",
                available ? "bg-emerald-500" : "bg-red-500",
              )}
              title={available ? "Disponível — clique para ficar Ausente" : "Ausente — clique para ficar Disponível"}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
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
              {onTogglePin && (
                <button
                  type="button"
                  onClick={onTogglePin}
                  className="h-7 w-7 shrink-0 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground"
                  title={pinned ? "Desafixar sidebar" : "Fixar sidebar"}
                >
                  {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-md border bg-background/40 px-3 py-2 text-sm">
              <span className="truncate flex-1">{wsName}</span>
              <NavLink
                to="/equipe-online"
                className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Equipe Online"
              >
                <Users className="h-3.5 w-3.5" />
              </NavLink>
              <button
                type="button"
                onClick={toggleAvailable}
                className={cn(
                  "h-3 w-3 rounded-full transition-colors",
                  available ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600",
                )}
                title={available ? "Disponível — clique para ficar Ausente" : "Ausente — clique para ficar Disponível"}
                aria-label="Alternar disponibilidade"
              />
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-y-auto">
        {sections.map((section) => (
          <SidebarGroup key={section.label || "main"} className="py-1">
            {!collapsed && section.label && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
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

        {!collapsed && (
          <SidebarGroup className="py-1">
            <SidebarGroupContent className="space-y-2 px-2">
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
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>


      <SidebarFooter className="border-t p-2 gap-2">
        {/* 3 menus fixos no rodapé com submenus via Popover (click-outside / Esc fecham) */}
        <SidebarMenu>
          {footerMenus.map((menu) => {
            const visibleItems = filterByRole(menu.items);
            if (visibleItems.length === 0) return null;
            const isActive = visibleItems.some((it) => pathname.startsWith(it.to));
            return (
              <SidebarMenuItem key={menu.key}>
                <Popover>
                  <PopoverTrigger asChild>
                    <SidebarMenuButton isActive={isActive} className="flex items-center gap-2">
                      <menu.icon className="h-4 w-4" />
                      {!collapsed && <span>{menu.label}</span>}
                    </SidebarMenuButton>
                  </PopoverTrigger>
                  <PopoverContent
                    side="right"
                    align="end"
                    sideOffset={8}
                    className="w-60 p-1"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {menu.label}
                    </div>
                    <div className="space-y-0.5">
                      {visibleItems.map((sub) => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          end={sub.to === "/admin"}
                          className={({ isActive: act }) =>
                            cn(
                              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                              "hover:bg-accent hover:text-accent-foreground",
                              act && "bg-accent text-accent-foreground",
                            )
                          }
                        >
                          <sub.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{sub.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>


        {!collapsed ? (
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
        ) : (
          <div className="flex flex-col items-center gap-1">
            <button className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-muted" aria-label="Ajuda">
              <HelpCircle className="h-4 w-4" />
            </button>
            <button className="h-9 w-9 rounded-md flex items-center justify-center hover:bg-muted" aria-label="Suporte">
              <LifeBuoy className="h-4 w-4" />
            </button>
            <button
              onClick={handleSignOut}
              className="h-9 w-9 rounded-md flex items-center justify-center text-destructive hover:bg-destructive/10"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

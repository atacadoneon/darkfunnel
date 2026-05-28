import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  Users,
  Filter,
  MessageCircle,
  Mail,
  Target,
  ListChecks,
  Calendar,
  CalendarDays,
  Phone,
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
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
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
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { useIsManagerOrAdmin } from "@/features/workspace/permissions";
import { usePlatformAdmin } from "@/hooks/usePlatformAdmin";
import { cn } from "@/lib/utils";
import logoDarkFunnel from "@/assets/darkfunnel-logo.png";

type Item = { title: string; url: string; icon: any };

const sections: { label: string; items: Item[] }[] = [
  {
    label: "",
    items: [
      { title: "CRM & Leads", url: "/funildevendas", icon: Filter },
      { title: "WhatsApp", url: "/chats", icon: MessageCircle },
      { title: "Discador", url: "/discador", icon: PhoneOutgoing },
      { title: "Ligações", url: "/calls", icon: Phone },
      { title: "Email Marketing", url: "/emailmarketing", icon: Mail },
      { title: "Propostas", url: "/propostas", icon: FileText },
      { title: "Pagamentos", url: "/pagamentos", icon: CreditCard },
    ],
  },
  {
    label: "Gestão",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutGrid },
      { title: "Metas", url: "/metas", icon: Target },
      { title: "Tarefas", url: "/tarefas", icon: ListChecks },
      { title: "Reuniões", url: "/reunioes", icon: Calendar },
      { title: "Agenda", url: "/agenda", icon: CalendarDays },
      { title: "Prospecção", url: "/prospeccao", icon: Search },
      { title: "Produtos", url: "/produtos", icon: Package },
    ],
  },

  {
    label: "Automação",
    items: [
      { title: "Fluxo de Cadência", url: "/cadencia", icon: MessageSquare },
      { title: "Automações", url: "/automacoes", icon: Workflow },
    ],
  },
];

export function AppSidebar({ pinned = false, onTogglePin }: { pinned?: boolean; onTogglePin?: () => void } = {}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { current } = useWorkspace();
  const { user } = useAuth();
  const canSeeSettings = useIsManagerOrAdmin();
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

  const isPlatformAdmin = usePlatformAdmin().data;

  const visibleSections = sections;

  const bottomItems: Item[] = [];
  if (canSeeSettings) bottomItems.push({ title: "Configurações", url: "/settings", icon: Settings });
  if (isPlatformAdmin) bottomItems.push({ title: "Admin", url: "/admin", icon: Shield });

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.user_metadata?.name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Usuário";

  const wsName = current?.name ?? "Conta";

  return (
    <Sidebar collapsible="icon">
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

      <SidebarContent className="gap-0">

        {visibleSections.map((section) => (
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

        {bottomItems.length > 0 && (
          <SidebarGroup className="py-1 mt-2 border-t">
            <SidebarGroupContent>
              <SidebarMenu>
                {bottomItems.map((item) => (
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
        )}

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
                className="w-full flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Painel do Parceiro
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


      <SidebarFooter className="border-t p-2">
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

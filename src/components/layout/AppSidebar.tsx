import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Inbox, Users, Settings, KanbanSquare, Briefcase, Headphones, Target } from "lucide-react";
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
import { cn } from "@/lib/utils";

type Mode = "atendimento" | "crm";

const menus: Record<Mode, { title: string; url: string; icon: any }[]> = {
  atendimento: [
    { title: "Inbox", url: "/app/inbox", icon: Inbox },
    { title: "Contatos", url: "/app/contacts", icon: Users },
  ],
  crm: [
    { title: "Pipeline", url: "/app/pipeline", icon: KanbanSquare },
    { title: "Negócios", url: "/app/deals", icon: Briefcase },
  ],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const [mode, setMode] = useState<Mode>(() =>
    pathname.startsWith("/app/pipeline") || pathname.startsWith("/app/deals") ? "crm" : "atendimento"
  );

  const items = menus[mode];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-2">
        {collapsed ? (
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setMode("atendimento")}
              className={cn(
                "h-9 w-9 mx-auto rounded-md flex items-center justify-center transition-colors",
                mode === "atendimento" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              )}
              aria-label="Atendimento"
            >
              <Headphones className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMode("crm")}
              className={cn(
                "h-9 w-9 mx-auto rounded-md flex items-center justify-center transition-colors",
                mode === "crm" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
              )}
              aria-label="CRM"
            >
              <Target className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setMode("atendimento")}
              className={cn(
                "flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-colors",
                mode === "atendimento"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Headphones className="h-3.5 w-3.5" />
              Atendimento
            </button>
            <button
              onClick={() => setMode("crm")}
              className={cn(
                "flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-colors",
                mode === "crm"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Target className="h-3.5 w-3.5" />
              CRM
            </button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel>{mode === "atendimento" ? "Atendimento" : "CRM"}</SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
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
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith("/app/settings")}>
              <NavLink to="/app/settings" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {!collapsed && <span>Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

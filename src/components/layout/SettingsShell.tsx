import { Outlet, NavLink } from "react-router-dom";
import { useState } from "react";
import {
  User, BarChart3, Building2, Tag, ShoppingCart, X, List, PlusCircle,
  FolderTree, Clock, CalendarCheck, Plug, Wifi, Server, Webhook, Database,
  Shuffle, Shield, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyRole, type WorkspaceRole } from "@/features/workspace/permissions";

type Item = {
  label: string;
  to: string;
  icon: typeof User;
  roles?: WorkspaceRole[];
  external?: boolean;
};

const items: Item[] = [
  { label: "Meu perfil", to: "/settings/perfil", icon: User },
  { label: "Planos e uso", to: "/settings/planos", icon: BarChart3 },
  { label: "Empresa", to: "/settings/empresa", icon: Building2 },
  { label: "Tags", to: "/settings/tags", icon: Tag },
  { label: "Produtos", to: "/produtos", icon: ShoppingCart, external: true },
  { label: "Motivos de perda", to: "/settings/motivos-perda", icon: X },
  { label: "Listas", to: "/settings/listas", icon: List },
  { label: "Campos adicionais", to: "/config/custom-fields", icon: PlusCircle },
  { label: "Departamentos", to: "/settings/departamentos", icon: FolderTree },
  { label: "Horários de trabalho", to: "/settings/horarios", icon: Clock },
  { label: "Tipos de atividades", to: "/settings/tipos-atividade", icon: CalendarCheck },
  { label: "Integrações", to: "/settings/integracoes", icon: Plug },
  { label: "Conexões", to: "/settings/canais", icon: Wifi },
  { label: "Servidor MCP", to: "/config/mcp-server", icon: Server },
  { label: "Webhooks de Entrada", to: "/config/inbound-webhooks", icon: Webhook, roles: ["proprietario", "gerente"] },
  { label: "Armazenamento", to: "/settings/armazenamento", icon: Database },
  { label: "Rodízio de Leads", to: "/settings/rodizio", icon: Shuffle, roles: ["proprietario", "gerente"] },
  { label: "Administração", to: "/admin", icon: Shield, roles: ["proprietario", "platform_admin"] },
];

export default function SettingsShell() {
  const [open, setOpen] = useState(true);
  const { data: role } = useMyRole();
  const visible = items.filter((it) => !it.roles || (role && it.roles.includes(role)));

  return (
    <div className="relative flex h-full min-h-[calc(100vh-3rem)] w-full">
      {open && (
        <aside className="w-[280px] shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
            <h2 className="text-sm font-semibold">Configurações</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Recolher"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <nav className="p-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-7rem)]">
            {visible.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/admin"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    isActive && !it.external && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <it.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{it.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute left-0 top-4 z-10 rounded-r-md border border-l-0 border-border bg-card p-2 hover:bg-accent"
          aria-label="Abrir Configurações"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

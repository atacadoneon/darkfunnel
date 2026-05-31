import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronLeft, Pin, PinOff, X as XIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebarState, type SubmenuId } from "@/contexts/SidebarContext";

export type SubmenuItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

export type SubmenuSection = {
  title?: string;
  items: SubmenuItem[];
};

interface SubmenuPanelProps {
  id: SubmenuId;
  title: string;
  items?: SubmenuItem[];
  sections?: SubmenuSection[];
  overlay?: boolean;
}

export function SubmenuPanel({ id, title, items, sections, overlay }: SubmenuPanelProps) {
  const {
    openSubmenu,
    setOpenSubmenu,
    pinnedSubmenus,
    togglePinSubmenu,
    pinned: sidebarPinned,
    expanded,
    setExpanded,
    closeSubmenu,
  } = useSidebarState();
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  const isPinned = !!pinnedSubmenus[id];
  const isOpen = openSubmenu === id;
  const visible = isOpen || isPinned;

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPinned) {
        setOpenSubmenu(null);
      }
    };
    const onDown = (e: MouseEvent) => {
      if (isPinned) return;
      if (!isOpen) return;
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      setOpenSubmenu(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [visible, isOpen, isPinned, setOpenSubmenu]);

  if (!visible) return null;

  const leftOffset = expanded
    ? "var(--sidebar-width, 12rem)"
    : "var(--sidebar-width-icon, 3.875rem)";

  const resolvedSections: SubmenuSection[] = sections ?? [{ items: items ?? [] }];

  const renderItem = (it: SubmenuItem) => {
    const active = pathname.startsWith(it.to);
    return (
      <NavLink
        key={it.to}
        to={it.to}
        end={it.to === "/admin"}
        onClick={() => {
          if (!isPinned) setOpenSubmenu(null);
          if (!sidebarPinned) setExpanded(false);
        }}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
          "text-foreground/80 hover:bg-accent hover:text-foreground",
          active && "bg-accent text-accent-foreground font-medium",
        )}
      >
        <it.icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{it.label}</span>
      </NavLink>
    );
  };

  return (
    <div
      ref={ref}
      className={cn(
        "fixed top-0 h-svh w-[210px] bg-sidebar border-r border-border shadow-xl flex flex-col",
        overlay ? "z-50" : "z-40",
      )}
      style={{ left: leftOffset }}
    >
      <div className="flex items-center justify-between border-b px-2 py-2.5 gap-1">
        <button
          type="button"
          onClick={() => closeSubmenu(id)}
          className="rounded-md p-1.5 text-foreground/60 hover:bg-accent hover:text-foreground"
          aria-label="Recolher"
          title="Recolher"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => togglePinSubmenu(id)}
          className="rounded-md p-1.5 text-foreground/60 hover:bg-accent hover:text-foreground"
          aria-label={isPinned ? "Desafixar" : "Fixar"}
          title={isPinned ? "Desafixar" : "Fixar"}
        >
          {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
        <h2 className="text-sm font-semibold flex-1 truncate">{title}</h2>
        <button
          type="button"
          onClick={() => closeSubmenu(id)}
          className="rounded-md p-1.5 text-foreground/60 hover:bg-accent hover:text-foreground"
          aria-label="Fechar"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {resolvedSections.map((section, idx) => (
          <div key={section.title ?? `__sec_${idx}`} className="space-y-0.5">
            {section.title && (
              <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </div>
            )}
            {section.items.map(renderItem)}
          </div>
        ))}
      </div>
    </div>
  );
}

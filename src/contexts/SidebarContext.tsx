import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export type SubmenuId = "automacoes" | "cadastros" | "configuracoes";

interface SidebarStateValue {
  expanded: boolean;
  setExpanded: (b: boolean) => void;
  pinned: boolean;
  setPinned: (b: boolean) => void;
  togglePinned: () => void;
  openSubmenu: SubmenuId | null;
  setOpenSubmenu: (id: SubmenuId | null) => void;
  toggleSubmenu: (id: SubmenuId) => void;
  pinnedSubmenus: Record<string, boolean>;
  togglePinSubmenu: (id: SubmenuId) => void;
  closeSubmenu: (id: SubmenuId) => void;
}

const SidebarStateContext = createContext<SidebarStateValue | null>(null);

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<SubmenuId | null>(null);
  const [pinnedSubmenus, setPinnedSubmenus] = useState<Record<string, boolean>>({});

  const setExpandedSafe = useCallback(
    (b: boolean) => {
      if (!b && pinned) return;
      setExpanded(b);
    },
    [pinned],
  );

  const togglePinned = useCallback(() => {
    setPinned((p) => {
      const next = !p;
      if (next) setExpanded(true);
      return next;
    });
  }, []);

  const toggleSubmenu = useCallback((id: SubmenuId) => {
    setOpenSubmenu((cur) => (cur === id ? null : id));
  }, []);

  const togglePinSubmenu = useCallback((id: SubmenuId) => {
    setPinnedSubmenus((p) => ({ ...p, [id]: !p[id] }));
  }, []);

  const closeSubmenu = useCallback(
    (id: SubmenuId) => {
      setPinnedSubmenus((p) => {
        if (!p[id]) return p;
        const { [id]: _, ...rest } = p;
        return rest;
      });
      setOpenSubmenu((cur) => (cur === id ? null : cur));
    },
    [],
  );

  return (
    <SidebarStateContext.Provider
      value={{
        expanded,
        setExpanded: setExpandedSafe,
        pinned,
        setPinned,
        togglePinned,
        openSubmenu,
        setOpenSubmenu,
        toggleSubmenu,
        pinnedSubmenus,
        togglePinSubmenu,
        closeSubmenu,
      }}
    >
      {children}
    </SidebarStateContext.Provider>
  );
}

export function useSidebarState() {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) throw new Error("useSidebarState must be used within SidebarStateProvider");
  return ctx;
}

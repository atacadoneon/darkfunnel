import { createContext, useContext, useEffect, useState, type ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";

export type WorkspaceFeatures = {
  import_history?: boolean;
  [key: string]: unknown;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  features?: WorkspaceFeatures | null;
};

type WorkspaceCtx = {
  workspaces: Workspace[];
  current: Workspace | null;
  loading: boolean;
  setCurrent: (id: string) => void;
  refresh: () => Promise<void>;
  createWorkspace: (name: string) => Promise<string>;
};

const Ctx = createContext<WorkspaceCtx>({} as WorkspaceCtx);
const STORAGE_KEY = "darkfunnel.current_workspace_id";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("workspaces")
      .select("id,name,slug,features")
      .order("created_at", { ascending: true });
    if (!error && data) {
      setWorkspaces(data as Workspace[]);
      if (!currentId || !data.find((w) => w.id === currentId)) {
        const next = data[0]?.id ?? null;
        setCurrentId(next);
        if (next) localStorage.setItem(STORAGE_KEY, next);
      }
    }
    setLoading(false);
  }, [user, currentId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setCurrent = (id: string) => {
    setCurrentId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const createWorkspace = async (name: string) => {
    const { data, error } = await supabase.rpc("create_workspace_for_current_user", {
      p_name: name,
    });
    if (error) throw error;
    await refresh();
    const id = data as unknown as string;
    setCurrent(id);
    return id;
  };

  const current = workspaces.find((w) => w.id === currentId) ?? null;

  return (
    <Ctx.Provider value={{ workspaces, current, loading, setCurrent, refresh, createWorkspace }}>
      {children}
    </Ctx.Provider>
  );
}

export const useWorkspace = () => useContext(Ctx);

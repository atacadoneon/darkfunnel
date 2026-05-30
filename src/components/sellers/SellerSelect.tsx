import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Seller = {
  workspace_id: string;
  id: string;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  department_id: string | null;
};

interface Props {
  value?: string | null;
  onValueChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  includeUnassigned?: boolean;
}

export function SellerSelect({
  value,
  onValueChange,
  placeholder = "Selecione um vendedor",
  disabled,
  className,
  includeUnassigned = false,
}: Props) {
  const { current } = useWorkspace();
  const { data: sellers, isLoading } = useQuery({
    queryKey: ["workspace-sellers", current?.id],
    enabled: !!current,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_sellers" as any)
        .select("*")
        .eq("workspace_id", current!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });

  const initials = (n?: string | null) =>
    (n ?? "?").trim().slice(0, 1).toUpperCase();

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => onValueChange(v === "__none__" ? "" : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={isLoading ? "Carregando…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeUnassigned && (
          <SelectItem value="__none__">
            <span className="text-muted-foreground">Sem vendedor</span>
          </SelectItem>
        )}
        {(sellers ?? []).map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                {s.avatar_url && <AvatarImage src={s.avatar_url} alt={s.name ?? ""} />}
                <AvatarFallback className="text-[10px]">{initials(s.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{s.name || "—"}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default SellerSelect;

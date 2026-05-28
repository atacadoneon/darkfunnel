import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, AlertTriangle } from "lucide-react";
import { useCreateMcpToken } from "@/hooks/useMcpTokens";
import { toast } from "sonner";

const SCOPES = [
  { value: "read", label: "read", desc: "Ler dados" },
  { value: "write", label: "write", desc: "Criar/atualizar" },
  { value: "destructive", label: "destructive", desc: "Excluir/operações destrutivas" },
];

export function CreateTokenDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [expDays, setExpDays] = useState<string>("");
  const [plain, setPlain] = useState<string | null>(null);
  const create = useCreateMcpToken();

  const submit = async () => {
    if (!name.trim()) return toast.error("Informe um nome");
    const token = await create.mutateAsync({
      name: name.trim(),
      scopes,
      expires_days: expDays ? Number(expDays) : null,
    });
    setPlain(token);
  };

  const close = () => {
    setName(""); setScopes(["read"]); setExpDays(""); setPlain(null);
    onOpenChange(false);
  };

  const copy = () => {
    if (!plain) return;
    navigator.clipboard.writeText(plain);
    toast.success("Token copiado");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plain ? "Token criado" : "Criar token MCP"}</DialogTitle>
        </DialogHeader>

        {!plain ? (
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Claude Desktop" />
            </div>
            <div>
              <Label>Escopos</Label>
              <div className="space-y-1.5 mt-1">
                {SCOPES.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={scopes.includes(s.value)}
                      onCheckedChange={(v) =>
                        setScopes((prev) => (v ? [...prev, s.value] : prev.filter((x) => x !== s.value)))
                      }
                    />
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">{s.label}</code>
                    <span className="text-xs text-muted-foreground">{s.desc}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>Expira em (dias, opcional)</Label>
              <Input type="number" value={expDays} onChange={(e) => setExpDays(e.target.value)} placeholder="30" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={close}>Cancelar</Button>
              <Button onClick={submit} disabled={create.isPending}>Criar token</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <strong>Salve agora.</strong> Este token não será exibido novamente.
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
              <code className="flex-1 text-xs break-all">{plain}</code>
              <Button size="icon" variant="ghost" onClick={copy}><Copy className="h-3.5 w-3.5" /></Button>
            </div>
            <DialogFooter>
              <Button onClick={close}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

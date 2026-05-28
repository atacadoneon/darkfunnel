import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Braces } from "lucide-react";
import { VariablePicker } from "./VariablePicker";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  flowId?: string;
  currentNodeId?: string;
  multiline?: boolean;
  className?: string;
};

export function VariableTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  flowId,
  currentNodeId,
  multiline = true,
  className,
}: Props) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  const insert = (token: string) => {
    const el = ref.current;
    if (!el) {
      onChange(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className={cn("relative", className)}>
      {multiline ? (
        <Textarea
          ref={ref as any}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="pr-10"
        />
      ) : (
        <Input
          ref={ref as any}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1 h-7 w-7 text-muted-foreground hover:text-primary"
        onClick={() => setOpen(true)}
        title="Inserir variável"
      >
        <Braces className="h-4 w-4" />
      </Button>
      <VariablePicker
        open={open}
        onClose={() => setOpen(false)}
        onPick={insert}
        flowId={flowId}
        currentNodeId={currentNodeId}
      />
    </div>
  );
}

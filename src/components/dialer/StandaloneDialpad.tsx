import { useMemo, useState } from "react";
import { Phone, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StandaloneDialpadProps {
  onCall: (digits: string) => void | Promise<void>;
  loading?: boolean;
  className?: string;
}

const KEYS: { d: string; sub?: string }[] = [
  { d: "1" }, { d: "2", sub: "ABC" }, { d: "3", sub: "DEF" },
  { d: "4", sub: "GHI" }, { d: "5", sub: "JKL" }, { d: "6", sub: "MNO" },
  { d: "7", sub: "PQRS" }, { d: "8", sub: "TUV" }, { d: "9", sub: "WXYZ" },
  { d: "*" }, { d: "0", sub: "+" }, { d: "#" },
];

function maskBR(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  const ddd = d.slice(0, 2);
  const mid = d.slice(2, 7);
  const end = d.slice(7, 11);
  let out = `+55 (${ddd}`;
  if (d.length <= 2) return out;
  out += `) ${mid}`;
  if (d.length <= 7) return out;
  out += `-${end}`;
  return out;
}

export function StandaloneDialpad({ onCall, loading, className }: StandaloneDialpadProps) {
  const [digits, setDigits] = useState("");
  const masked = useMemo(() => maskBR(digits), [digits]);
  const canCall = digits.replace(/\D/g, "").length >= 10;

  const press = (c: string) => setDigits((s) => (s + c).slice(0, 14));
  const back = () => setDigits((s) => s.slice(0, -1));

  return (
    <div className={cn("w-full max-w-sm mx-auto flex flex-col gap-4 p-6", className)}>
      <div className="text-center">
        <div className="text-2xl font-semibold tracking-tight tabular-nums min-h-[2.5rem] flex items-center justify-center">
          {masked || <span className="text-muted-foreground/40">Digite um número</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-1">Brasil (+55)</div>
      </div>

      <div className="grid grid-cols-3 gap-3 justify-items-center">
        {KEYS.map((k) => (
          <button
            key={k.d}
            type="button"
            onClick={() => press(k.d)}
            className="h-16 w-16 rounded-full bg-muted hover:bg-accent active:scale-95 transition flex flex-col items-center justify-center font-semibold text-xl shadow-sm"
          >
            {k.d}
            {k.sub && <span className="text-[9px] text-muted-foreground font-medium tracking-wider">{k.sub}</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={() => canCall && onCall(digits)}
          disabled={!canCall || loading}
          className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
        >
          <Phone className="h-5 w-5" /> Ligar
        </Button>
        <Button
          variant="outline"
          onClick={back}
          disabled={!digits}
          className="h-12 w-12 p-0"
          aria-label="Apagar dígito"
        >
          <Delete className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

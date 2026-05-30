import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Undo2, Redo2, Image as ImageIcon, Eraser, Type,
} from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

const wrap = (
  ta: HTMLTextAreaElement,
  before: string,
  after: string,
  onChange: (v: string) => void,
) => {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const v = ta.value;
  const sel = v.slice(start, end) || "texto";
  const next = v.slice(0, start) + before + sel + after + v.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(start + before.length, start + before.length + sel.length);
  });
};

const prefixLines = (
  ta: HTMLTextAreaElement,
  prefix: string,
  onChange: (v: string) => void,
) => {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const v = ta.value;
  const sel = v.slice(start, end) || "item";
  const next =
    v.slice(0, start) +
    sel.split("\n").map((l) => prefix + l).join("\n") +
    v.slice(end);
  onChange(next);
};

export function FreetextEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const act = (fn: (ta: HTMLTextAreaElement) => void) => () => {
    const ta = ref.current;
    if (!ta) return;
    fn(ta);
  };

  const insertImage = act((ta) => {
    const url = window.prompt("URL da imagem:");
    if (!url) return;
    wrap(ta, `![`, `](${url})`, onChange);
  });

  const clearFormat = act((ta) => {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const v = ta.value;
    const sel = v.slice(start, end);
    const cleaned = sel.replace(/(\*\*|__|\*|_|~~|`)/g, "").replace(/^#+\s*/gm, "");
    onChange(v.slice(0, start) + cleaned + v.slice(end));
  });

  return (
    <div className="border rounded-md">
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5 bg-muted/30">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={act((ta) => wrap(ta, "**", "**", onChange))} title="Negrito"><Bold className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={act((ta) => wrap(ta, "*", "*", onChange))} title="Itálico"><Italic className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={act((ta) => wrap(ta, "__", "__", onChange))} title="Sublinhado"><UnderlineIcon className="h-3.5 w-3.5" /></Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={act((ta) => prefixLines(ta, "# ", onChange))} title="Título"><Type className="h-3.5 w-3.5" /></Button>
        <select
          className="h-7 text-xs bg-transparent border rounded px-1"
          onChange={(e) => {
            const ta = ref.current; if (!ta) return;
            const c = e.target.value;
            if (c) wrap(ta, `<span style="color:${c}">`, `</span>`, onChange);
            e.target.value = "";
          }}
          defaultValue=""
          title="Cor"
        >
          <option value="">Cor</option>
          <option value="#111">Preto</option>
          <option value="#ef4444">Vermelho</option>
          <option value="#10b981">Verde</option>
          <option value="#3b82f6">Azul</option>
          <option value="#f59e0b">Laranja</option>
        </select>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={act((ta) => prefixLines(ta, "", onChange))} title="Alinhar esquerda"><AlignLeft className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={act((ta) => wrap(ta, "<center>", "</center>", onChange))} title="Centralizar"><AlignCenter className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={act((ta) => wrap(ta, '<div style="text-align:right">', "</div>", onChange))} title="Alinhar direita"><AlignRight className="h-3.5 w-3.5" /></Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={act((ta) => prefixLines(ta, "- ", onChange))} title="Lista"><List className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={act((ta) => prefixLines(ta, "1. ", onChange))} title="Lista numerada"><ListOrdered className="h-3.5 w-3.5" /></Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => document.execCommand("undo")} title="Desfazer"><Undo2 className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => document.execCommand("redo")} title="Refazer"><Redo2 className="h-3.5 w-3.5" /></Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={insertImage} title="Imagem"><ImageIcon className="h-3.5 w-3.5" /></Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={clearFormat} title="Limpar formatação"><Eraser className="h-3.5 w-3.5" /></Button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="w-full p-3 text-sm bg-background outline-none resize-y font-mono"
        placeholder="Escreva as condições comerciais. Suporta Markdown: **negrito**, *itálico*, # título, - lista..."
      />
    </div>
  );
}

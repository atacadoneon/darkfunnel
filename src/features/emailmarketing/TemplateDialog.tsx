import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCreateTemplate, useUpdateTemplate, htmlToText, type EmailTemplate } from "./hooks";

type Props = { open: boolean; onOpenChange: (v: boolean) => void; template?: EmailTemplate | null };

export function TemplateDialog({ open, onOpenChange, template }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const create = useCreateTemplate();
  const update = useUpdateTemplate();

  useEffect(() => {
    if (open) {
      setName(template?.name ?? "");
      setCategory(template?.category ?? "");
      setSubject(template?.subject ?? "");
      setBodyHtml(template?.body_html ?? "");
    }
  }, [open, template]);

  async function save() {
    if (!name.trim()) return;
    const payload = { name: name.trim(), category: category.trim() || null, subject: subject.trim() || null, body_html: bodyHtml, body_text: htmlToText(bodyHtml) };
    if (template) await update.mutateAsync({ id: template.id, patch: payload });
    else await create.mutateAsync(payload);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{template ? "Editar template" : "Novo template"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nome *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Categoria</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: marketing, transactional" /></div>
          <div className="col-span-2"><Label>Assunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        </div>
        <Tabs defaultValue="edit" className="mt-2">
          <TabsList><TabsTrigger value="edit">Editor HTML</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList>
          <TabsContent value="edit"><Textarea rows={14} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} className="font-mono text-xs" placeholder="<h1>Olá {{name}}</h1>..." /></TabsContent>
          <TabsContent value="preview"><iframe title="preview" className="w-full h-80 border rounded bg-white" srcDoc={bodyHtml} /></TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!name.trim() || create.isPending || update.isPending} onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function AiHelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
          <Sparkles className="h-4 w-4" />
          Ajuda IA
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            Ajuda IA
          </SheetTitle>
          <SheetDescription>
            Assistente inteligente integrado.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-violet-400 opacity-60" />
          Em breve
        </div>
      </SheetContent>
    </Sheet>
  );
}

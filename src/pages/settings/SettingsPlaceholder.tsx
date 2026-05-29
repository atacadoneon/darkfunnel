import { Card } from "@/components/ui/card";

export default function SettingsPlaceholder({ title }: { title: string }) {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground mb-6">Em construção.</p>
      <Card className="p-10 text-center border-dashed text-sm text-muted-foreground">
        Esta área estará disponível em breve.
      </Card>
    </div>
  );
}

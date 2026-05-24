import { Construction } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <EmptyState
        icon={Construction}
        title={title}
        description="Esta área está em construção e estará disponível em breve."
      />
    </div>
  );
}

import { UsersSection } from "@/features/workspace/UsersSection";

export default function UsuariosPage() {
  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
        <p className="text-sm text-muted-foreground">Gerencie os usuários da sua conta e setores.</p>
      </header>
      <UsersSection />
    </div>
  );
}

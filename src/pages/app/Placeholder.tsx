export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      {title} · em breve
    </div>
  );
}

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  hasMore: boolean;
  isFetching: boolean;
  onIntersect: () => void;
};

export function LoadMoreSentinel({ hasMore, isFetching, onIntersect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetching) onIntersect();
      },
      { rootMargin: "200px" },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [hasMore, isFetching, onIntersect]);
  if (!hasMore) return null;
  return (
    <div ref={ref} className="py-6 flex justify-center">
      {isFetching ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <button
          onClick={onIntersect}
          className="text-sm text-primary hover:underline"
        >
          Carregar mais
        </button>
      )}
    </div>
  );
}

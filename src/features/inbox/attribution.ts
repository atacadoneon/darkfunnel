export type AttributionMeta = {
  label: string;
  className: string;
};

export const ATTRIBUTION_MAP: Record<string, AttributionMeta> = {
  meta_ctwa: { label: "Meta Ads", className: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300" },
  meta_link: { label: "Meta Ads", className: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300" },
};

export function getAttribution(source: string | null | undefined): AttributionMeta | null {
  if (!source) return null;
  return ATTRIBUTION_MAP[source] ?? null;
}

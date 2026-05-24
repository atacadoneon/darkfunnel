export type WorkspaceFeatures = {
  import_history?: boolean;
  [key: string]: unknown;
};

export function isFeatureEnabled(
  features: Record<string, any> | null | undefined,
  feature: string,
): boolean {
  return !!features?.[feature];
}

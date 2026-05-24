export type WorkspaceFeatures = {
  import_history?: boolean;
};

export type Workspace = {
  id: string;
  name: string;
  slug?: string;
  features?: WorkspaceFeatures;
};

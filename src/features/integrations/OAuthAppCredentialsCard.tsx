import { IntegrationCredentialsCard } from "./IntegrationCredentialsCard";
import type { OAuthAppSlug } from "@/hooks/useOAuthApps";

const META: Record<OAuthAppSlug, { label: string; helpUrl: string }> = {
  tiny_erp: { label: "Tiny ERP", helpUrl: "https://developers.tiny.com.br/" },
  bling:    { label: "Bling", helpUrl: "https://developer.bling.com.br/" },
};

/**
 * @deprecated Use IntegrationCredentialsCard directly.
 * Kept as alias to avoid breaking /settings/integracoes/tiny e /bling.
 */
export function OAuthAppCredentialsCard({ slug }: { slug: OAuthAppSlug }) {
  const meta = META[slug];
  return (
    <IntegrationCredentialsCard
      slug={slug}
      name={meta.label}
      helpUrl={meta.helpUrl}
      showRedirectUri
    />
  );
}

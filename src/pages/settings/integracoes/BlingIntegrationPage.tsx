import { IntegrationDetailShell } from "@/components/integrations/IntegrationDetailShell";

export default function BlingIntegrationPage() {
  return (
    <IntegrationDetailShell
      slug="bling"
      name="Bling"
      supportsV2={false}
      v2HelpUrl="https://developer.bling.com.br/"
      oauthAuthorizeFunction="bling-oauth-authorize"
      syncFunction="bling-v3-sync"
    />
  );
}

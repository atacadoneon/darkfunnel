import { IntegrationDetailShell } from "@/components/integrations/IntegrationDetailShell";

export default function TinyIntegrationPage() {
  return (
    <IntegrationDetailShell
      slug="tiny_erp"
      name="Tiny ERP"
      supportsV2={true}
      v2HelpUrl="https://www.tiny.com.br/ajuda/api2"
      oauthAuthorizeFunction="tiny-oauth-authorize"
      syncFunction="tiny-v3-sync"
      v2ImportFunction="tiny-v2-import"
    />
  );
}

import { OidcBrandingForm } from "@blocks-idp/authentication/components/oidc/oidc-branding-form";
import { useParams } from "react-router-dom";

export default function OidcBrandingPage() {
  const { clientId = "" } = useParams<{ clientId: string }>();

  return <OidcBrandingForm clientId={clientId} />;
};

import { useEffect, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSignOut, useT } from "@seliseblocks/genesis-os";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { EmptyState } from "@/components/ui-kits/empty-state";
import { http } from "@/lib/http/http-client";
import { AUTH_ENDPOINTS } from "@blocks-idp/iam/constants/endpoint.constant";

/** The part of IAM's `GET auth/me` this gate reads. */
interface IAuthMeResponse {
  org_id?: string;
  /** "disabled" only on the session of a user whose organizations are all disabled. */
  org_status?: string;
}

/** Tenant-agnostic (see `TENANT_AGNOSTIC_KEY_PREFIXES`), so it is fetched once per app load. */
const AUTH_ME_QUERY_KEY = ["auth-me"] as const;

const ORGANIZATION_STATUS_DISABLED = "disabled";

const getAuthMe = (): Promise<IAuthMeResponse> =>
  http.get<IAuthMeResponse>(AUTH_ENDPOINTS.ME, undefined, { absoluteUrl: true });

const OrganizationDisabledMessage = () => {
  const { t } = useT("os.shared");
  const signOut = useSignOut();
  const signOutRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    signOutRef.current?.focus();
  }, []);

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <EmptyState
        icon={Ban}
        title={t("ORGANIZATION_DISABLED_GATE.TITLE")}
        description={t("ORGANIZATION_DISABLED_GATE.MESSAGE")}
        descriptionRole="alert"
        className="w-full text-center sm:max-w-lg"
        action={
          <Button ref={signOutRef} variant="outline" onClick={signOut}>
            {t("ORGANIZATION_DISABLED_GATE.SIGN_OUT")}
          </Button>
        }
      />
    </div>
  );
};

/**
 * Shows the disabled-organization message instead of the `/app` content when IAM reports that all
 * of the signed-in user's organizations are disabled. It only changes what is shown: such a session
 * holds no roles or permissions. The content renders while `auth/me` loads and when it fails, so
 * the request never delays or blocks the console.
 */
export const OrganizationDisabledGate = ({ children }: { children: ReactNode }) => {
  const { data } = useQuery({
    queryKey: AUTH_ME_QUERY_KEY,
    queryFn: getAuthMe,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // One request per app load, also when it fails (the app default retries once).
    retry: false,
  });

  if (data?.org_status === ORGANIZATION_STATUS_DISABLED) return <OrganizationDisabledMessage />;

  return <>{children}</>;
};

import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { getRuntimeEnv } from "@/lib/runtime-env";
import LogoLoadingSpinner from "@/components/loader-spinner/loader-spinner";

export default function SsoCallbackPage() {
  const [searchParams] = useSearchParams();
  const hasProcessed = useRef(false);
  const { setAuthenticated } = useAuthStore();

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const tenantId = searchParams.get("tenant_id");

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const idpBaseUrl = getRuntimeEnv("BLOCKS_IAM_BASE_URL");
    const callbackUrl = new URL(`${idpBaseUrl}/api/oidc/oidc/callback`);
    // Forward the callback parameters to backend
    if (code) callbackUrl.searchParams.set("code", code);
    if (state) callbackUrl.searchParams.set("state", state);
    if (error) callbackUrl.searchParams.set("error", error);
    if (tenantId) callbackUrl.searchParams.set("tenant_id", tenantId);

    const headers: Record<string, string> = {};
    if (tenantId) {
      headers["X-Blocks-Key"] = tenantId;
    }

    // console.log({ state, code });

    // return;

    fetch(callbackUrl.toString(), { headers, credentials: "include" })
      .then((res) => {
        if (res.ok) {
          setAuthenticated();
          window.location.href = "/console";
        } else {
          window.location.href = "/login?error=callback_failed";
        }
      })
      .catch(() => {
        window.location.href = "/login?error=callback_error";
      });
  }, [code, state, error, tenantId, setAuthenticated]);

  return <LogoLoadingSpinner />;
}

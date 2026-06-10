import { useEffect } from "react";
import { getRuntimeEnv } from "@/lib/runtime-env";
import LogoLoadingSpinner from "@/components/loader-spinner/loader-spinner";

export function ProfileRedirect() {
  useEffect(() => {
    const iamBaseUrl = getRuntimeEnv("BLOCKS_IAM_BASE_URL").replace(/\/+$/, "");
    window.location.href = `${iamBaseUrl}/profile`;
  }, []);

  return <LogoLoadingSpinner />;
}

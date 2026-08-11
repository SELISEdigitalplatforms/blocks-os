import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { githubInfoService } from "@/cross-modules/devops/services/github-info.service";
import LogoLoadingSpinner from "@/components/loader-spinner/loader-spinner";

export default function GitHubCallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const [projectKey] = useState(() => localStorage.getItem("github_auth_project_key") || "");
  const { isLoading, isSuccess } = useQuery({
    queryKey: ["github-verification", code, projectKey],
    queryFn: () => githubInfoService.verifyAuthorization(code || "", projectKey),
    enabled: !!code,
    retry: false,
  });
  useEffect(() => {
    if (isSuccess) {
      // Use a unique value each time. The `storage` event does NOT fire when
      // setItem is called with a value equal to the one already stored, so a
      // fixed "true" can get stuck and never notify the opener tab again.
      localStorage.setItem("isReload", `${Date.now()}`);
      // Clean up stored auth data
      localStorage.removeItem("github_auth_state");
      localStorage.removeItem("github_auth_project_key");
      localStorage.removeItem("github_auth_destination");
      if (typeof window !== "undefined") {
        window.close();
      }
    }
  }, [isSuccess]);
  if (isLoading) {
    return <LogoLoadingSpinner />;
  }
  if (isSuccess) {
    return null;
  }
  return null;
}

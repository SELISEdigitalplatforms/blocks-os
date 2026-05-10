import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useImpersonateStore } from "@/store/useImpersonateStore";
import { useStartImpersonation, useStopImpersonation } from "@/hooks/use-impersonation";
import { useAppState } from "./public-guard";
import { IDP_BASE_URL } from "@/constants/endpoint.constant";
import { useGetUser } from "@/idp/iam/hooks/use-user";

export function ProtectedGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const { isMounted } = useAppState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isMounted) return;
    if (!isAuthenticated) return navigate(`${IDP_BASE_URL}/login`, { replace: true });
  }, [isAuthenticated, isMounted, navigate]);
  if (!isMounted || !isAuthenticated) return null;
  return <>{children}</>;
}

export function UserChecker({ children }: { children: React.ReactNode }) {
    const navigate = useNavigate();
    const { data: loggedInUser, isLoading } = useGetUser();
    const { setUser } = useAuthStore();

    useEffect(() => {
        if(!loggedInUser?.data) return navigate(`${IDP_BASE_URL}/login`, { replace: true });
        setUser(loggedInUser.data);
    }, [loggedInUser, navigate, setUser]);

    if(isLoading) return null;
  return <>{children}</>;
}

export function ImpersonateGuard({ children }: { children: React.ReactNode }) {
  const { isImpersonated, impersonatedTenantId } = useImpersonateStore();
  const { mutate: startImpersonation } = useStartImpersonation();
  const { mutate: stopImpersonation } = useStopImpersonation();

  if (isImpersonated && impersonatedTenantId) {
    return (
      <>
        {children}
      </>
    );
  }

  return <>{children}</>;
}

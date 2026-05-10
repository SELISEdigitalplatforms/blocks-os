import { useMutation } from "@tanstack/react-query";
import { impersonationService, type ImpersonationRequest } from "@/services/impersonation.service";
import { useImpersonateStore } from "@/store/useImpersonateStore";
import { showErrorToast } from "@/hooks/use-toast";
import { useProjectStore } from "@/store/useProjectStore";
import { isErrorWithErrors } from "@/lib/error";

export const useStartImpersonation = () => {
  const { startImpersonation } = useImpersonateStore();
  const { selectedProject } = useProjectStore();

  return useMutation({
    mutationFn: (request: ImpersonationRequest) =>
      impersonationService.startImpersonation(request),
    onSuccess: (data, variables) => {
      startImpersonation(
        variables.targetTenantId,
        data.rootTenantId || selectedProject?.tenantId || "",
      );
    },
    onError: (error) => {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
    },
  });
};

export const useStopImpersonation = () => {
  const { stopImpersonation } = useImpersonateStore();

  return useMutation({
    mutationFn: () => impersonationService.stopImpersonation(),
    onSuccess: () => {
      stopImpersonation();
    },
    onError: (error) => {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
    },
  });
};

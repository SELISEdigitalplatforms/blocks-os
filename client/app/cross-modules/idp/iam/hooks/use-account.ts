import { userService } from "@blocks-idp/iam/services/user.service";
import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

export const useAccountActivation = () => {
  return useMutation({
    mutationKey: ["account", "activation"],
    mutationFn: userService.account.accountActivation,
  });
};

export const useAccountResendActivation = () => {
  return useMutation({
    mutationKey: ["account", "resend-activation"],
    mutationFn: userService.account.accountResendActivation,
  });
};

/**
 * After a status change, success or not, re-read only the user acted on (the detail page shows the
 * server's status, never an optimistic one) and mark the Users list stale. The operator's own
 * record (`["user"]`) is not refetched.
 */
const refreshChangedUser = (queryClient: QueryClient, userId: string) => {
  void queryClient.invalidateQueries({
    queryKey: ["user-by-id"],
    predicate: (query) => (query.queryKey[1] as { id?: string } | undefined)?.id === userId,
  });
  void queryClient.invalidateQueries({ queryKey: ["users"] });
};

export const useAccountDeactivate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["account", "deactivate"],
    mutationFn: userService.accountDeactivate,
    onSettled: (_data, _error, variables) => refreshChangedUser(queryClient, variables.userId),
  });
};

export const useAccountActivateByAdmin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["account", "activate-by-admin"],
    mutationFn: userService.accountActivateByAdmin,
    onSettled: (_data, _error, variables) => refreshChangedUser(queryClient, variables.userId),
  });
};

export const useAccountRecover = () => {
  return useMutation({
    mutationKey: ["account", "recover"],
    mutationFn: userService.account.accountRecover,
  });
};

export const useAdminResetPassword = () => {
  return useMutation({
    mutationKey: ["account", "admin-reset-password"],
    mutationFn: userService.adminResetPassword,
  });
};

export const useAccountResetPassword = () => {
  return useMutation({
    mutationKey: ["account", "reset-password"],
    mutationFn: userService.account.accountResetPassword,
  });
};

export const useAccountActivationCodeExpiration = () => {
  return useMutation({
    mutationKey: ["account", "activation-code-expiration"],
    mutationFn: userService.account.checkActivationCodeExpiration,
  });
};

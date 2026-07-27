import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { mfaService } from "../services/mfa.service";
import { IGetUserByIdPayload } from "@blocks-idp/iam/models/user";

// The project MFA config endpoint resolves the tenant from the request token, so the
// active tenant must be part of the query key to avoid serving another project's cache.
export const useGetMFAConfig = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["mfa-config", "get", tenantId],
    queryFn: () => mfaService.getConfigurations(),
    enabled: !!tenantId,
  });
};

export const useGetProfileMFAConfig = () => {
  return useQuery({
    queryKey: ["profile-mfa-config", "get"],
    queryFn: () => mfaService.getProfileMfaConfiguration(),
  });
};

export const useSaveMFAConfig = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  return useMutation({
    mutationKey: ["mfa-config", "save"],
    mutationFn: mfaService.saveMFAConfiguration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mfa-config", "get", tenantId] });
    },
  });
};

export const useConfigureUserMFA = (option: { id: string; projectKey: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["mfa-config", "configure"],
    mutationFn: mfaService.configureUserMFA,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", option] });
      queryClient.invalidateQueries({ queryKey: ["user-by-id", option] });
      queryClient.invalidateQueries({ queryKey: ["profile-user", option] });
    },
  });
};

export const useGetTotp = (option: { id: string; projectKey: string }) => {
  return useQuery({
    queryKey: ["mfa-config", "setup-totp", option],
    queryFn: () => mfaService.setupUserTotp(option),
  });
};

export const useGenerateUserMfaOTP = () => {
  return useMutation({
    mutationKey: ["mfa-config", "generate-otp"],
    mutationFn: mfaService.generateUserMfaOTP,
  });
};

export const useVerifyMfaOTP = (option: IGetUserByIdPayload & { own?: boolean }) => {
  const queryClient = useQueryClient();
  const { own = false, ...rest } = option;
  return useMutation({
    mutationKey: ["mfa-config", "verify-otp"],
    mutationFn: mfaService.verifyOtp,
    onSuccess: () => {
      if (own) {
        queryClient.invalidateQueries({ queryKey: ["user"] });
        queryClient.invalidateQueries({ queryKey: ["profile-user"] });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["user", rest] });
      queryClient.invalidateQueries({ queryKey: ["user-by-id", rest] });
      queryClient.invalidateQueries({ queryKey: ["profile-user", rest] });
    },
  });
};

export const useResendMfaOTP = () => {
  return useMutation({
    mutationKey: ["mfa-config", "resend-otp"],
    mutationFn: mfaService.resendOtp,
  });
};
export const useDisableMfa = (option: { id: string; projectKey: string }) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["mfa-config", "disable"],
    mutationFn: mfaService.disableMFA,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", option] });
      queryClient.invalidateQueries({ queryKey: ["user-by-id", option] });
      queryClient.invalidateQueries({ queryKey: ["profile-user", option] });
    },
  });
};

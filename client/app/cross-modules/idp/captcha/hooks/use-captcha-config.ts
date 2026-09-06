import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { captchaService } from "../services/captcha.service";
import { IGetCaptchaConfigPayload } from "../models/captcha";

export const useGetCaptchaConfigList = (
  options: IGetCaptchaConfigPayload,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["captcha-config", "list", options.projectKey],
    queryFn: () => captchaService.getCaptchaConfigList(),
    enabled: !!options.projectKey && enabled,
  });
};

export const useSaveCaptcha = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["captcha-config", "save"],
    mutationFn: captchaService.saveCaptcha,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captcha-config"] });
      // The backend creates or rotates the linked service secret as part of a captcha save.
      // Invalidate the active Secret page query so its GET runs again immediately.
      queryClient.invalidateQueries({ queryKey: ["secrets", "list"] });
    },
  });
};

export const useToggleCaptchaConfigStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["captcha-config", "status-update"],
    mutationFn: captchaService.updateCaptchaConfigStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captcha-config"] });
    },
  });
};

export const useDeleteCaptcha = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["captcha-config", "delete"],
    mutationFn: captchaService.deleteCaptchaConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captcha-config"] });
    },
  });
};

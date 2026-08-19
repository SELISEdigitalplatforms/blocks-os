import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { captchaService } from "../services/captcha.service";
import { IGetCaptchaConfigPayload } from "../models/captcha";

export const useGetCaptchaConfig = (
  options: IGetCaptchaConfigPayload,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["captcha-config", options.projectKey],
    queryFn: () => captchaService.getCaptchaConfig(),
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { captchaService } from "../services/captcha.service";
import { IGetCaptchaConfigsPayload } from "../models/captcha";

export const useGetCaptchaConfigs = (
  options: IGetCaptchaConfigsPayload,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["captcha-configs", options.projectKey],
    queryFn: () => captchaService.getCaptchaConfigs(options),
    enabled: !!options.projectKey && enabled,
  });
};

export const useSaveCaptcha = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["captcha-config", "save"],
    mutationFn: captchaService.saveCaptcha,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captcha-configs"] });
    },
  });
};

export const useToggleCaptchaConfigStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["captcha-config", "status-update"],
    mutationFn: captchaService.updateCaptchaConfigStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captcha-configs"] });
    },
  });
};

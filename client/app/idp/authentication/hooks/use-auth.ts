import { useMutation } from "@tanstack/react-query";
import { authService } from "@blocks-idp/authentication/services/auth.service";

export const useLogout = () => {
  return useMutation({
    mutationKey: ["logout"],
    mutationFn: authService.logout,
  });
};


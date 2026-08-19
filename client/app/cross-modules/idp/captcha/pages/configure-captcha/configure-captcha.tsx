import { ConfigureCaptchaList } from "./configure-captcha-list";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetCaptchaConfig } from "../../hooks/use-captcha-config";
export const ConfigureCaptcha = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { isLoading, isFetching, data } = useGetCaptchaConfig({ projectKey: tenantId });
  return (
    <div className="flex w-full flex-col">
      <ConfigureCaptchaList isLoading={isLoading || isFetching} configuration={data ?? null} />
    </div>
  );
};

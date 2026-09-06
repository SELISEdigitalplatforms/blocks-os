import { ConfigureCaptchaList } from "./configure-captcha-list";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useGetCaptchaConfigList } from "../../hooks/use-captcha-config";
import { useFindSecrets } from "@/cross-modules/secrets/hooks/use-secret-management";
export const ConfigureCaptcha = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { isLoading, isFetching, data } = useGetCaptchaConfigList({ projectKey: tenantId });
  // Captcha credentials are persisted in Secret Management. Keep the default Secret page query
  // warm while this screen is mounted so newly configured credentials are reflected there too.
  useFindSecrets({ pageNumber: 1, pageSize: 10 }, !!tenantId);
  return (
    <div className="flex w-full flex-col">
      <ConfigureCaptchaList isLoading={isLoading || isFetching} configurations={data ?? []} />
    </div>
  );
};

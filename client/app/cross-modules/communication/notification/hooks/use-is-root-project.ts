import { useProjectStore } from "@seliseblocks/genesis-os";
import { getRuntimeEnv } from "@/lib/runtime-env";

/**
 * True when the selected project is the root tenant (the console's own tenant). Only root may change
 * the shared fields of a built-in notification; the server checks it again, this only keeps the form honest.
 */
export const useIsRootProject = (): boolean => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId;
  const rootTenantId = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");
  return !!tenantId && !!rootTenantId && tenantId === rootTenantId;
};

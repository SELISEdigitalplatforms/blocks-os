import { useProjectStore } from "@seliseblocks/genesis-os";

export const useSettingsTenantId = () => useProjectStore().selectedProject?.tenantId ?? "";

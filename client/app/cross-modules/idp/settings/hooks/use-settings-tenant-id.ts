import { useProjectStore } from "@seliseblocks/blocks-kit"

export const useSettingsTenantId = () =>
  useProjectStore().selectedProject?.tenantId ?? ""

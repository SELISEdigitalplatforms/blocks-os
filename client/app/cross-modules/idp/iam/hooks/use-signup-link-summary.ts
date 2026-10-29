import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { signupLinkSummaryService } from "../services/signup-link-summary.service";
import { ISignupLinkSummaryPayload } from "../models/signup-link-summary";

export const useSignupLinkSummary = (
  payload: ISignupLinkSummaryPayload | null,
  { enabled = true }: { enabled?: boolean } = {},
) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const configurationId = payload?.configurationId ?? "";
  return useQuery({
    queryKey: [
      "signup-link-summary",
      {
        configurationId,
        fromUtc: payload?.fromUtc,
        toUtc: payload?.toUtc,
      },
      tenantId,
    ],
    queryFn: () => {
      if (!payload?.configurationId) {
        throw new Error("configurationId is required");
      }
      return signupLinkSummaryService.getSummary(payload);
    },
    enabled: enabled && !!tenantId && !!configurationId,
    placeholderData: keepPreviousData,
  });
};

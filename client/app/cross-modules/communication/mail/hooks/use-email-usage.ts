import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { emailService } from "@blocks-communication/mail/services/email.services";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { EMAIL_USAGE_REFETCH_INTERVAL } from "@blocks-communication/mail/constants/email-usage";

export const useGetEmailUsage = (
  page: number,
  pageSize: number,
  isInbound: boolean,
  searchText?: string,
  status?: string,
  startDate?: string,
  endDate?: string,
  mailServerConfigurationId?: string,
) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  return useQuery({
    queryKey: [
      "email-usage",
      page,
      pageSize,
      isInbound,
      searchText,
      status,
      startDate,
      endDate,
      mailServerConfigurationId,
      tenantId,
    ],
    queryFn: async () => {
      if (!tenantId) return { data: [], totalCount: 0 };
      const response = await emailService.getMailBoxMails(
        page,
        pageSize,
        isInbound,
        searchText,
        status,
        startDate,
        endDate,
        mailServerConfigurationId,
      );
      return {
        data: response.mails,
        totalCount: response.totalCount,
      };
    },
    enabled: !!tenantId,
    refetchInterval: EMAIL_USAGE_REFETCH_INTERVAL,
  });
};

export const useGetEmailUsageById = (id: string) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: ["email-usage-details", id, tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const response = await emailService.getMailBoxMail(id);
      return response.content ? { ...response.mail, content: response.content } : response.mail;
    },
    enabled: !!tenantId && !!id,
  });
};

/** One cache entry per message source, shared by the Original view and the `.eml` download. */
export const emailUsageSourceQueryKey = (id: string, tenantId: string) =>
  ["email-usage-source", id, tenantId] as const;

/** The stored message as bytes. They are kept as bytes so the `.eml` is saved unchanged. */
export const fetchEmailUsageSource = async (id: string): Promise<Uint8Array<ArrayBuffer>> => {
  const blob = await emailService.getMailBoxMailSource(id);
  return new Uint8Array(await blob.arrayBuffer());
};

// The source can be megabytes: fetch it once per page view, and do not repeat a failed request
// (a retried 404 would only delay the error toast).
const SOURCE_QUERY_OPTIONS = { retry: false, staleTime: Infinity } as const;

/** The message source, fetched only while `enabled` (the Original view is open). */
export const useGetEmailUsageSource = (id: string, enabled: boolean) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  return useQuery({
    queryKey: emailUsageSourceQueryKey(id, tenantId),
    queryFn: () => fetchEmailUsageSource(id),
    enabled: enabled && !!tenantId && !!id,
    ...SOURCE_QUERY_OPTIONS,
  });
};

/**
 * Loads the message source on demand (the `.eml` button) through the same cache entry as
 * `useGetEmailUsageSource`, so a source that is already loaded is not requested again.
 */
export const useFetchEmailUsageSource = (id: string) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      queryClient.fetchQuery({
        queryKey: emailUsageSourceQueryKey(id, tenantId),
        queryFn: () => fetchEmailUsageSource(id),
        ...SOURCE_QUERY_OPTIONS,
      }),
    [queryClient, id, tenantId],
  );
};

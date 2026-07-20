import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IAPIResponse } from "@/models/api-response";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import type { ILog } from "../models/log.model";
import { lmtService } from "../services/lmt.service";

type UseLogsParams = {
  serviceName: string;
  serviceNames?: string[];
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
  level?: string;
};

type LogsFetchKeyInput = {
  serviceName: string;
  serviceNames: string[];
  tenantId: string;
  pageSize: number;
  startDate: string;
  endDate: string;
  search: string;
  level: string;
};

const buildInitialFetchKey = ({
  serviceName,
  serviceNames,
  tenantId,
  pageSize,
  startDate,
  endDate,
  search,
  level,
}: LogsFetchKeyInput) =>
  JSON.stringify({
    serviceName,
    serviceNames,
    tenantId,
    pageSize,
    startDate,
    endDate,
    search,
    level,
  });

const inFlightInitialFetches = new Map<string, Promise<IAPIResponse<ILog[]>>>();
const EMPTY_SERVICE_NAMES: string[] = [];

export const useLogs = ({
  serviceName,
  serviceNames = EMPTY_SERVICE_NAMES,
  pageSize = 20,
  startDate = "",
  endDate = "",
  search = "",
  level = "",
}: UseLogsParams) => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [initialLogs, setInitialLogs] = useState<ILog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasTopMore, setHasTopMore] = useState<boolean>(true);
  const [page, setPage] = useState<number>(0);
  const fetchKeyRef = useRef("");
  const effectiveServiceNames = useMemo(
    () => (serviceNames.length > 0 ? serviceNames : serviceName ? [serviceName] : []),
    [serviceName, serviceNames],
  );

  const generateFetchLogsPayload = useCallback(() => {
    return {
      pageSize,
      serviceName,
      serviceNames: effectiveServiceNames,
      filter: {
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
        ...(level && { level }),
      },
      search,
    };
  }, [effectiveServiceNames, endDate, level, pageSize, search, serviceName, startDate]);

  useEffect(() => {
    let cancelled = false;

    const fetchInitialLogs = async () => {
      if (!effectiveServiceNames.length) {
        setInitialLogs([]);
        setIsLoading(false);
        setHasTopMore(false);
        fetchKeyRef.current = "";
        return;
      }

      if (!tenantId) {
        setIsLoading(true);
        return;
      }

      const fetchKey = buildInitialFetchKey({
        serviceName,
        serviceNames: effectiveServiceNames,
        tenantId,
        pageSize,
        startDate,
        endDate,
        search,
        level,
      });

      fetchKeyRef.current = fetchKey;
      setIsLoading(true);
      setInitialLogs([]);
      setHasTopMore(true);
      setPage(0);

      let request = inFlightInitialFetches.get(fetchKey);
      if (!request) {
        request = lmtService.log.getLogsByDate(generateFetchLogsPayload());
        inFlightInitialFetches.set(fetchKey, request);
        void request
          .finally(() => {
            if (inFlightInitialFetches.get(fetchKey) === request) {
              inFlightInitialFetches.delete(fetchKey);
            }
          })
          .catch(() => undefined);
      }

      try {
        const res = await request;
        if (cancelled || fetchKeyRef.current !== fetchKey) return;

        if (res.data.length) setInitialLogs(res.data.reverse());
        else setInitialLogs([]);

        if (res.totalCount && res.totalCount <= pageSize) setHasTopMore(false);
      } catch (_error) {
        if (!cancelled && fetchKeyRef.current === fetchKey) setInitialLogs([]);
      } finally {
        if (!cancelled && fetchKeyRef.current === fetchKey) setIsLoading(false);
      }
    };

    void fetchInitialLogs();

    return () => {
      cancelled = true;
    };
  }, [
    endDate,
    effectiveServiceNames,
    generateFetchLogsPayload,
    level,
    pageSize,
    search,
    serviceName,
    startDate,
    tenantId,
  ]);

  const fetchOldLogs = useCallback(
    async (lastDate: string) => {
      try {
        const payload = generateFetchLogsPayload();
        payload.filter.endDate = lastDate;
        const res = await lmtService.log.getLogsByDate(payload);
        if (res.totalCount && res.totalCount <= page * pageSize)
          setHasTopMore(false);
        setPage((currentPage) => currentPage + 1);
        if (!res.data.length) return [];
        return res.data.reverse();
      } catch (_error) {
        return [];
      }
    },
    [generateFetchLogsPayload, page, pageSize],
  );

  const fetchNewLogs = useCallback(
    async (lastDate: string) => {
      try {
        if (!effectiveServiceNames.length || !tenantId || isLoading) return [];
        const response = await lmtService.log.getLiveLog({
          serviceName,
          serviceNames: effectiveServiceNames,
          projectKey: tenantId,
          lastDate,
        });
        return response?.data.reverse() || [];
      } catch (_error) {
        return [];
      }
    },
    [effectiveServiceNames, isLoading, serviceName, tenantId],
  );

  return { initialLogs, isLoading, hasTopMore, fetchOldLogs, fetchNewLogs };
};

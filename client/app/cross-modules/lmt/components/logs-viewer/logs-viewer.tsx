import {
  createContext,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LogsListHeader } from "../logs-header/logs-header";
import { cn } from "@/lib/utils";
import { LogsList } from "../logs-list";
import type { LogServiceIconKey } from "../../models/log-entry.model";
import { useQueryState } from "nuqs";
import type { RegisteredService } from "@/cross-modules/identifier/models/service.model";

export interface Service {
  id: string;
  label: string;
  serviceName: string;
  serviceNames?: string[];
  icon?: LogServiceIconKey;
  _raw?: RegisteredService;
}
export interface LogFilter {
  search: string;
  startDate: string;
  endDate: string;
  level: string;
  service: string;
  subService: string;
}
interface LogsViewerContextType {
  pageSize: number;
  services: Service[];
  selectedService: Service | null;
  changeService: (service: Service) => void;
  filter: Partial<LogFilter> | null;
  setFilter: Dispatch<SetStateAction<Partial<LogFilter> | null>>;
  resetFilter: () => void;
  predefinedQueries?: string[];
  agentName?: string;
  askAiDescription?: string;
  logsRouteServiceName?: string;
  useGenericTraceLinks?: boolean;
  isSourceBlocks: boolean;
  subService: string;
  setSubService: (value: string | null) => Promise<URLSearchParams>;
  isManagedLoading: boolean;
}
const initialContextValue: LogsViewerContextType = {
  services: [],
  selectedService: null,
  changeService: () => {},
  pageSize: 0,
  filter: null,
  setFilter: () => {},
  resetFilter: () => {},
  predefinedQueries: [],
  agentName: "Ask AI",
  askAiDescription: "",
  logsRouteServiceName: undefined,
  useGenericTraceLinks: false,
  isSourceBlocks: true,
  subService: "all",
  setSubService: (value: string | null) =>
    Promise.resolve(new URLSearchParams({ subService: value || "" })),
  isManagedLoading: false,
};
// Create context with the initial value
export const LogsViewerContext = createContext<LogsViewerContextType>(initialContextValue);
interface LogsViewerProps {
  services: Service[];
  startDate?: string;
  endDate?: string;
  pageSize?: number;
  className?: string;
  predefinedQueries?: string[];
  agentName?: string;
  askAiDescription?: string;
  logsRouteServiceName?: string;
  useGenericTraceLinks?: boolean;
  isSourceBlocks?: boolean;
  isManagedLoading?: boolean;
}
export const LogsViewer = ({
  pageSize = 20,
  services,
  className,
  predefinedQueries,
  agentName = "Ask AI",
  askAiDescription,
  logsRouteServiceName,
  useGenericTraceLinks = false,
  isSourceBlocks = true,
  isManagedLoading = false,
}: LogsViewerProps) => {
  const defaultServiceId = services.length > 0 ? services[0].id : "";
  const [serviceId, setServiceId] = useQueryState("service", {
    defaultValue: defaultServiceId,
  });
  const [subService, setSubService] = useQueryState("subService", {
    defaultValue: "all",
  });

  const selectedService = useMemo(() => {
    return services.find((s) => s.id === serviceId) || (services.length > 0 ? services[0] : null);
  }, [services, serviceId]);

  // Compute the effective selected service with serviceNames based on subService
  const effectiveSelectedService = useMemo(() => {
    if (!selectedService) return null;
    if (!isSourceBlocks) return selectedService;

    // For blocks services, filter serviceNames based on subService
    const allServiceNames = selectedService.serviceNames || [selectedService.serviceName];
    let filteredServiceNames: string[];
    if (subService === "all") {
      filteredServiceNames = allServiceNames;
    } else if (subService === "api") {
      filteredServiceNames = allServiceNames.filter((name) => !name.includes("worker"));
    } else if (subService === "worker") {
      filteredServiceNames = allServiceNames.filter((name) => name.includes("worker"));
    } else {
      filteredServiceNames = allServiceNames;
    }

    return {
      ...selectedService,
      serviceNames: filteredServiceNames,
    };
  }, [selectedService, isSourceBlocks, subService]);

  const [filter, setFilter] = useState<Partial<LogFilter> | null>(null);

  // Update serviceId when services change
  useEffect(() => {
    const newDefaultServiceId = services.length > 0 ? services[0].id : "";
    if (newDefaultServiceId && !services.find((s) => s.id === serviceId)) {
      setServiceId(newDefaultServiceId);
    }
  }, [services, serviceId, setServiceId]);

  const changeService = useCallback(
    (service: Service) => {
      setServiceId(service.id);
    },
    [setServiceId],
  );

  const resetFilter = () => {
    setFilter(null);
  };
  return (
    <LogsViewerContext.Provider
      value={{
        pageSize,
        services,
        selectedService: effectiveSelectedService,
        changeService,
        filter,
        setFilter,
        resetFilter,
        predefinedQueries,
        agentName,
        askAiDescription,
        logsRouteServiceName,
        useGenericTraceLinks,
        isSourceBlocks,
        subService,
        setSubService,
        isManagedLoading,
      }}
    >
      <div className={cn("flex flex-col gap-6", className)}>
        <LogsListHeader />
        <LogsList
          key={`${effectiveSelectedService?.id ?? "none"}-${JSON.stringify(filter ?? null)}`}
        />
      </div>
    </LogsViewerContext.Provider>
  );
};

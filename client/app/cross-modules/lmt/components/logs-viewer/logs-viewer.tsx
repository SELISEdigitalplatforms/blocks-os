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

export interface ServiceComponent {
  label: string;
  value: string;
}
export interface Service {
  id: string;
  label: string;
  serviceName: string;
  serviceNames?: string[];
  components?: ServiceComponent[];
  icon?: LogServiceIconKey;
  _raw?: RegisteredService;
}
export interface LogFilter {
  search: string;
  startDate: string;
  endDate: string;
  level: string;
  service: string;
}
interface LogsViewerContextType {
  pageSize: number;
  services: Service[];
  selectedService: Service | null;
  serviceFilterValue: string;
  changeService: (service: Service, componentValue?: string | null) => void;
  filter: Partial<LogFilter> | null;
  setFilter: Dispatch<SetStateAction<Partial<LogFilter> | null>>;
  resetFilter: () => void;
  predefinedQueries?: string[];
  agentName?: string;
  askAiDescription?: string;
  logsRouteServiceName?: string;
  useGenericTraceLinks?: boolean;
  isSourceBlocks: boolean;
  isServicesLoading: boolean;
}
const initialContextValue: LogsViewerContextType = {
  services: [],
  selectedService: null,
  serviceFilterValue: "",
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
  isServicesLoading: false,
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
  isServicesLoading?: boolean;
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
  isServicesLoading = false,
}: LogsViewerProps) => {
  const defaultServiceId = services.length > 0 ? services[0].id : "";
  // Encodes both the selected service and an optional narrowed component (e.g. its
  // worker) as "<serviceId>" or "<serviceId>::<componentValue>", so picking a
  // component doesn't need a second query param or a separate filter control.
  const [serviceKey, setServiceKey] = useQueryState("service", {
    defaultValue: defaultServiceId,
  });
  const [serviceId, componentValue] = useMemo(() => {
    const [id, component] = serviceKey.split("::");
    return [id, component || null];
  }, [serviceKey]);

  const baseSelectedService = useMemo(() => {
    return services.find((s) => s.id === serviceId) || (services.length > 0 ? services[0] : null);
  }, [services, serviceId]);

  const selectedService = useMemo(() => {
    if (!baseSelectedService) return null;
    const isValidComponent = baseSelectedService.components?.some((c) => c.value === componentValue);
    if (!isValidComponent) return baseSelectedService;
    return { ...baseSelectedService, serviceNames: [componentValue as string] };
  }, [baseSelectedService, componentValue]);

  const [filter, setFilter] = useState<Partial<LogFilter> | null>(null);

  // Update serviceId when services change
  useEffect(() => {
    const newDefaultServiceId = services.length > 0 ? services[0].id : "";
    if (newDefaultServiceId && !services.find((s) => s.id === serviceId)) {
      setServiceKey(newDefaultServiceId);
    }
  }, [services, serviceId, setServiceKey]);

  const changeService = useCallback(
    (service: Service, componentValue?: string | null) => {
      setServiceKey(componentValue ? `${service.id}::${componentValue}` : service.id);
    },
    [setServiceKey],
  );

  const resetFilter = () => {
    setFilter(null);
  };
  return (
    <LogsViewerContext.Provider
      value={{
        pageSize,
        services,
        selectedService,
        serviceFilterValue: serviceKey,
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
        isServicesLoading,
      }}
    >
      <div className={cn("flex flex-col gap-6", className)}>
        <LogsListHeader />
        <LogsList key={selectedService?.id ?? "none"} />
      </div>
    </LogsViewerContext.Provider>
  );
};

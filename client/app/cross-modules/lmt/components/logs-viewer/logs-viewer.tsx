import { createContext, useCallback, useEffect, useState } from "react";
import { LogsListHeader } from "../logs-header/logs-header";
import { cn } from "@/lib/utils";
import { LogsList } from "../logs-list";
import type { LogServiceIconKey } from "../../models/log-entry.model";
export interface Service {
  id: string;
  label: string;
  serviceName: string;
  serviceNames?: string[];
  icon?: LogServiceIconKey;
}
export interface LogFilter {
  search: string;
  startDate: string;
  endDate: string;
  level: string;
}
interface LogsViewerContextType {
  services: Service[];
  selectedService: Service | null;
  changeService: (service: Service) => void;
  pageSize: number;
  filter: Partial<LogFilter> | null;
  setFilter: React.Dispatch<React.SetStateAction<Partial<LogFilter> | null>>;
  resetFilter: () => void;
  predefinedQueries?: string[];
  serviceNames?: string[];
  agentName?: string;
  askAiDescription?: string;
  logsRouteServiceName?: string;
  useGenericTraceLinks?: boolean;
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
}: LogsViewerProps) => {
  const [selectedService, setSelectedService] = useState<Service | null>(
    services.length > 0 ? services[0] : null,
  );
  const [filter, setFilter] = useState<Partial<LogFilter> | null>(null);

  useEffect(() => {
    setSelectedService((current) => {
      if (current && services.some((service) => service.id === current.id)) return current;
      return services.length > 0 ? services[0] : null;
    });
  }, [services]);

  const changeService = useCallback((service: Service) => {
    setSelectedService((current) => (current?.id === service.id ? current : service));
  }, []);
  const resetFilter = () => {
    setFilter(null);
  };
  return (
    <LogsViewerContext.Provider
      value={{
        pageSize,
        services,
        selectedService,
        changeService,
        filter,
        setFilter,
        resetFilter,
        predefinedQueries,
        agentName,
        askAiDescription,
        logsRouteServiceName,
        useGenericTraceLinks,
      }}
    >
      <div className={cn("flex flex-col gap-6", className)}>
        <LogsListHeader />
        <LogsList
          key={`${selectedService?.id ?? "none"}-${JSON.stringify(filter ?? null)}`}
        />
      </div>
    </LogsViewerContext.Provider>
  );
};

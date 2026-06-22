import { createContext, useCallback, useState } from "react";
import { LogsListHeader } from "../logs-header/logs-header";
import { cn } from "@/lib/utils";
import { LogsList } from "../logs-list";
export interface Service {
  id: string;
  label: string;
  serviceName: string;
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
}
export const LogsViewer = ({
  pageSize = 20,
  services,
  className,
  predefinedQueries,
  agentName = "Ask AI",
  askAiDescription,
  logsRouteServiceName,
}: LogsViewerProps) => {
  const [selectedService, setSelectedService] = useState<Service | null>(
    services.length > 0 ? services[0] : null,
  );
  const [filter, setFilter] = useState<Partial<LogFilter> | null>(null);
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

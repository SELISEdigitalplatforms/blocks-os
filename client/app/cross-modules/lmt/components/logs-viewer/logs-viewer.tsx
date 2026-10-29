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
import { buildServiceKey, parseServiceKey, treeValuesToServiceKey } from "../../utils";
import { TRACE_PROVIDERS, TRACE_REQUEST_SOURCE_TYPE } from "@blocks-lmt/constants/trace.constant";
import { useRestoreRequest } from "@blocks-lmt/hooks/use-restore-request";
import { useLogsTier } from "@blocks-lmt/hooks/use-logs-tier";
import type { StorageTier } from "../storage-tier-cards/storage-tier-cards";
import { RestoredLogsPanel } from "../restored-logs/restored-logs-panel";

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
  /**
   * Absolute window from the time-range picker, in UTC. Mutually exclusive with
   * {@link LogFilter.range}. An empty endDate means the window runs to the present moment,
   * which is what lets the list keep tailing; a pinned endDate stops it.
   */
  startDate: string;
  endDate: string;
  /**
   * Relative window such as "30m", used only for the window the page opens on -- the picker
   * offers absolute windows exclusively. Held separately from startDate rather than resolved
   * into it, so that the opening view has no end to stream past and keeps tailing.
   */
  range: string;
  level: string;
  service: string;
}

/** The logs list opens on a relative window rather than on the whole retention period. */
export const DEFAULT_LOG_FILTER: Partial<LogFilter> = { range: "30m" };
interface LogsViewerContextType {
  pageSize: number;
  services: Service[];
  /** First entry of {@link selectedServices}; kept for consumers that need one service. */
  selectedService: Service | null;
  /** Every checked service, each narrowed to its checked components. */
  selectedServices: Service[];
  /** Flat list of log collections to query across all selected services. */
  selectedServiceNames: string[];
  serviceFilterValue: string;
  changeService: (service: Service, componentValues?: string | string[] | null) => void;
  /** Replaces the whole selection from checkbox-tree option values. */
  changeServices: (treeValues: string[]) => void;
  filter: Partial<LogFilter> | null;
  setFilter: Dispatch<SetStateAction<Partial<LogFilter> | null>>;
  resetFilter: () => void;
  predefinedQueries?: string[];
  agentName?: string;
  askAiDescription?: string;
  /**
   * Whether the list header offers the agent. A page that puts the agent in its own page
   * header -- as the Logs route does, to sit where Tracing's does -- turns it off here so the
   * one button isn't offered twice.
   */
  showAgent: boolean;
  logsRouteServiceName?: string;
  useGenericTraceLinks?: boolean;
  isSourceBlocks: boolean;
  isServicesLoading: boolean;
  /** Which storage tier is being read: live logs, or the logs of a restore. */
  tier: StorageTier;
  /** Whether the reader may leave live logs at all -- see {@link LogsViewerProps.projectKey}. */
  canSwitchTier: boolean;
  changeTier: (tier: StorageTier) => void;
  /**
   * The restore whose rows are on screen, empty over live logs. Rows link into their own
   * restore with it, and the filter toolbar uses it to know it is over a closed window.
   */
  restoreRequestId: string;
  /** The days that restore covers, so the picker can be bounded to them. */
  restoreWindow: { startDate?: string; endDate?: string };
}
const initialContextValue: LogsViewerContextType = {
  services: [],
  selectedService: null,
  selectedServices: [],
  selectedServiceNames: [],
  serviceFilterValue: "",
  changeService: () => {},
  changeServices: () => {},
  pageSize: 0,
  filter: null,
  setFilter: () => {},
  resetFilter: () => {},
  predefinedQueries: [],
  agentName: "Blocks Agent",
  askAiDescription: "",
  showAgent: true,
  logsRouteServiceName: undefined,
  useGenericTraceLinks: false,
  isSourceBlocks: true,
  isServicesLoading: false,
  tier: TRACE_PROVIDERS.hot,
  canSwitchTier: false,
  changeTier: () => {},
  restoreRequestId: "",
  restoreWindow: {},
};
// Create context with the initial value
export const LogsViewerContext = createContext<LogsViewerContextType>(initialContextValue);
/** A tier a restore can be read from, keyed by the tier the reader picked. */
const RESTORE_SOURCE_TYPE: Partial<Record<StorageTier, TRACE_REQUEST_SOURCE_TYPE>> = {
  [TRACE_PROVIDERS.cold]: TRACE_REQUEST_SOURCE_TYPE.cold,
  [TRACE_PROVIDERS.archive]: TRACE_REQUEST_SOURCE_TYPE.archive,
};

/**
 * What the list opens on, per tier. Live logs open on the last 30 minutes; a restore covers a
 * closed set of past days, where a relative window would match nothing at all.
 */
const tierDefaultFilter = (tier: StorageTier): Partial<LogFilter> =>
  tier === TRACE_PROVIDERS.hot ? DEFAULT_LOG_FILTER : {};

interface LogsViewerProps {
  services: Service[];
  /** The project whose restores are read. Without it no restore can be looked up. */
  projectKey?: string;
  startDate?: string;
  endDate?: string;
  pageSize?: number;
  className?: string;
  predefinedQueries?: string[];
  agentName?: string;
  askAiDescription?: string;
  /** See {@link LogsViewerContextType.showAgent}. */
  showAgent?: boolean;
  logsRouteServiceName?: string;
  useGenericTraceLinks?: boolean;
  isSourceBlocks?: boolean;
  isServicesLoading?: boolean;
}
// The collections a service covers: its checked components, or everything it owns.
const serviceNamesOf = (service: Service) =>
  service.serviceNames?.length
    ? service.serviceNames
    : service.serviceName
      ? [service.serviceName]
      : [];

export const LogsViewer = ({
  pageSize = 20,
  services,
  projectKey = "",
  className,
  predefinedQueries,
  agentName = "Blocks Agent",
  askAiDescription,
  showAgent = true,
  logsRouteServiceName,
  useGenericTraceLinks = false,
  isSourceBlocks = true,
  isServicesLoading = false,
}: LogsViewerProps) => {
  const defaultServiceId = services.length > 0 ? services[0].id : "";
  // Encodes every selected service and its narrowed components in one param — see
  // service-selection.util for the format — so picking services doesn't need extra
  // query params or a separate filter control.
  const [serviceKey, setServiceKey] = useQueryState("service", {
    defaultValue: defaultServiceId,
  });
  const selections = useMemo(() => parseServiceKey(serviceKey), [serviceKey]);

  const selectedServices = useMemo(() => {
    const resolved = selections
      .map(({ serviceId, components }) => {
        const service = services.find((s) => s.id === serviceId);
        if (!service) return null;
        const validComponents = (service.components ?? [])
          .filter((component) => components.includes(component.value))
          .map((component) => component.value);
        return validComponents.length ? { ...service, serviceNames: validComponents } : service;
      })
      .filter((service): service is Service => service !== null);
    // The list always needs at least one service to query.
    if (resolved.length === 0) return services.length > 0 ? [services[0]] : [];
    return resolved;
  }, [selections, services]);

  const selectedService = selectedServices[0] ?? null;
  const selectedServiceNames = useMemo(
    () => [...new Set(selectedServices.flatMap(serviceNamesOf))],
    [selectedServices],
  );

  // A restore belongs to a project. Without one -- the per-service logs route passes none --
  // there is nothing to read on the restored tiers, so they are not offered at all.
  const canReadRestores = Boolean(projectKey);
  const { tier, setTier } = useLogsTier(canReadRestores);
  const restoreSourceType = RESTORE_SOURCE_TYPE[tier];

  // Resolved from the initial tier rather than reset by an effect, so a link straight to
  // ?tab=cold never opens on the live default and re-queries a moment later.
  const [filter, setFilter] = useState<Partial<LogFilter> | null>(() => tierDefaultFilter(tier));

  const restore = useRestoreRequest({
    sourceType: restoreSourceType ?? TRACE_REQUEST_SOURCE_TYPE.cold,
    projectKey,
    enabled: Boolean(restoreSourceType),
  });

  const changeTier = useCallback(
    (next: StorageTier) => {
      setTier(next);
      // Each tier has its own window, so carrying a filter across would leave the reader with
      // a window that belongs to the tier they just left.
      setFilter(tierDefaultFilter(next));
    },
    [setTier],
  );

  // Drop services that no longer exist once the service list loads or changes.
  useEffect(() => {
    const newDefaultServiceId = services.length > 0 ? services[0].id : "";
    if (!newDefaultServiceId) return;
    const knownSelections = selections.filter((selection) =>
      services.some((service) => service.id === selection.serviceId),
    );
    if (knownSelections.length === 0) {
      setServiceKey(newDefaultServiceId);
      return;
    }
    if (knownSelections.length !== selections.length) {
      setServiceKey(buildServiceKey(knownSelections));
    }
  }, [services, selections, setServiceKey]);

  const changeService = useCallback(
    (service: Service, componentValues?: string | string[] | null) => {
      const components = (
        Array.isArray(componentValues) ? componentValues : [componentValues]
      ).filter((component): component is string => !!component);
      setServiceKey(buildServiceKey([{ serviceId: service.id, components }]));
    },
    [setServiceKey],
  );

  const changeServices = useCallback(
    (treeValues: string[]) => {
      // An empty selection falls back to the whole first service — the list always
      // needs one service to query.
      setServiceKey(treeValuesToServiceKey(treeValues) || defaultServiceId);
    },
    [defaultServiceId, setServiceKey],
  );

  // Reset returns to the default window rather than clearing it, so the list never falls
  // back to querying the entire retention period by accident.
  const resetFilter = () => {
    setFilter(tierDefaultFilter(tier));
  };
  return (
    <LogsViewerContext.Provider
      value={{
        pageSize,
        services,
        selectedService,
        selectedServices,
        selectedServiceNames,
        serviceFilterValue: serviceKey,
        changeService,
        changeServices,
        filter,
        setFilter,
        resetFilter,
        predefinedQueries,
        agentName,
        askAiDescription,
        showAgent,
        logsRouteServiceName,
        useGenericTraceLinks,
        isSourceBlocks,
        isServicesLoading,
        tier,
        canSwitchTier: canReadRestores,
        changeTier,
        restoreRequestId: restoreSourceType ? restore.requestId : "",
        restoreWindow: restoreSourceType
          ? { startDate: restore.startDate, endDate: restore.endDate }
          : {},
      }}
    >
      <div className={cn("flex flex-col gap-6", className)}>
        {/* The tier switcher rides in the list header beside the service tabs -- see
            LogsListHeader. */}
        <LogsListHeader />
        {restoreSourceType ? (
          <RestoredLogsPanel sourceType={restoreSourceType} restore={restore} />
        ) : (
          /* Deliberately not keyed on the selection: LogsList also renders the filter
             toolbar, and remounting it would tear down an open filter popover on every
             checkbox click. LogsList resets its own scroll list instead. */
          <LogsList />
        )}
      </div>
    </LogsViewerContext.Provider>
  );
};

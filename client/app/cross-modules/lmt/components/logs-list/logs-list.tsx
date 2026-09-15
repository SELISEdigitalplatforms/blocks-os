import { Loader } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { LogItem } from "./log-item";
import { InfiniteScroll } from "@/components/infinite-scroller";
import { useContext, useMemo } from "react";
import { LogsViewerContext } from "../logs-viewer";
import { useLogs } from "../../hooks/use-logs";
import { getRangeStartDate } from "../../utils";
import { LogsFilterToolbar } from "../logs-header/logs-filter-toolbar";
import { ILog } from "../../models/log.model";
// UI: New Data Available Indicator
const NewDataAvailableIndicator = ({ onBottomClick }: { onBottomClick: () => void }) => (
  <div
    className="absolute bottom-4 left-1/2 inline-flex h-9 -translate-x-1/2 cursor-pointer items-center justify-center whitespace-nowrap rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    onClick={(e) => {
      e.stopPropagation();
      onBottomClick();
    }}
  >
    New logs available
  </div>
);
// UI: Loading Indicator for Older Data
const OldDataFetchingIndicator = () => (
  <div className="flex w-full items-center justify-center py-4">
    <Loader size={80} className="animate-spin text-gray-400" />
  </div>
);
export const LogsList = () => {
  const { selectedService, selectedServiceNames, filter, pageSize, isServicesLoading, services } =
    useContext(LogsViewerContext);
  const { level, startDate, endDate, search, range } = filter || {
    level: "",
    startDate: "",
    endDate: "",
    search: "",
    range: "",
  };
  // Resolved once per preset change rather than on every render. Recomputing it live would
  // shift the window every minute, and each shift restarts the query -- wiping the loaded
  // rows and the scroll position mid-read. Pinning it means "the 30 minutes before you
  // chose this", with the poller appending anything newer.
  const rangeStartDate = useMemo(() => getRangeStartDate(range ?? ""), [range]);
  // serviceNames spans every selected service; serviceName stays the primary one so the
  // API keeps a single-collection fallback when nothing is narrowed.
  const serviceName = selectedService?.serviceName ?? "";
  const serviceNames = selectedServiceNames;
  const initialTimeStamp = useMemo(() => (endDate ? endDate : new Date().toISOString()), [endDate]);
  const { initialLogs, isLoading, hasTopMore, fetchOldLogs, fetchNewLogs } = useLogs({
    serviceName,
    serviceNames,
    search: search,
    level,
    startDate: rangeStartDate ?? startDate,
    endDate: initialTimeStamp,
    pageSize,
  });
  const fetchNewLogsHandler = async (lastItemTimestamp: string = initialTimeStamp) => {
    // Only a pinned end stops the stream: streaming past the end of a closed window would
    // return logs the reader excluded. A window left open at the end -- the default view
    // included -- contains every log that arrives next, so it keeps tailing.
    if (search || level || endDate) return [];
    return await fetchNewLogs(lastItemTimestamp);
  };

  const noServices = services.length === 0;

  return (
    <Card className="relative">
      <CardHeader>
        <LogsFilterToolbar />
      </CardHeader>
      <CardContent className="h-[calc(100vh-340px)]">
        {isServicesLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading services...
          </div>
        ) : noServices ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No services found.
          </div>
        ) : isLoading ? (
          <div className="grid h-full w-full gap-2 overflow-hidden">
            {Array.from({ length: 20 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <InfiniteScroll<ILog>
            // InfiniteScroll seeds its rows from initialData once, so changing the
            // queried collections needs a fresh instance to drop the previous logs.
            key={serviceNames.join("|")}
            loadingIndicator={<OldDataFetchingIndicator />}
            initialData={initialLogs}
            hasTopMore={hasTopMore}
            topFn={(item) => {
              if (!item) return Promise.resolve([]);
              return fetchOldLogs(item.timestamp);
            }}
            pollingInterval={5000}
            pollingFn={(item) => fetchNewLogsHandler(item?.timestamp)}
            renderItem={(log) => (
              // Keyed on the log's own identity rather than its position: polling prepends new
              // rows every few seconds, so an index-based key would hand a row's expanded stack
              // trace to whichever log later lands at that index.
              <div
                key={`${log.timestamp}-${log.spanId ?? ""}`}
                className="w-full cursor-default border-b border-border/60 px-3 py-2.5 text-sm text-muted-foreground last:border-b-0 hover:bg-muted/40"
              >
                <LogItem log={log} />
              </div>
            )}
            bottomIndicator={(cb) => <NewDataAvailableIndicator onBottomClick={cb} />}
          />
        )}
      </CardContent>
    </Card>
  );
};

import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Calendar } from "@/components/ui-kits/calendar/calendar";
import { Label } from "@/components/ui-kits/label/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { useGetSignupLinkConfigurations } from "@blocks-idp/iam/hooks/use-signup-link-configurations";
import { ISignupLinkConfiguration } from "@blocks-idp/iam/models/signup-link-configuration";
import { CalendarIcon } from "lucide-react";
import { parseAsString, useQueryStates } from "nuqs";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/utils";

export type ActivityRange = "7d" | "30d" | "90d" | "custom";

export const useSignupLinkActivityQueryParams = () => {
  const [queryParams, setQueryParams] = useQueryStates({
    configurationId: parseAsString.withDefault(""),
    range: parseAsString.withDefault("30d"),
    fromUtc: parseAsString.withDefault(""),
    toUtc: parseAsString.withDefault(""),
  });
  return { queryParams, setQueryParams };
};

/** Trailing window start/end in UTC ISO. Used for 7d and 90d presets only. */
export const computeTrailingUtcBounds = (days: number, now = new Date()) => {
  const toUtc = now.toISOString();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { fromUtc: from.toISOString(), toUtc };
};

export const buildSummaryPayload = (params: {
  configurationId: string;
  range: string;
  fromUtc: string;
  toUtc: string;
}) => {
  if (!params.configurationId) return null;
  if (params.range === "30d") {
    return { configurationId: params.configurationId };
  }
  if (params.range === "7d") {
    const bounds = computeTrailingUtcBounds(7);
    return { configurationId: params.configurationId, ...bounds };
  }
  if (params.range === "90d") {
    const bounds = computeTrailingUtcBounds(90);
    return { configurationId: params.configurationId, ...bounds };
  }
  // custom
  const payload: { configurationId: string; fromUtc?: string; toUtc?: string } = {
    configurationId: params.configurationId,
  };
  if (params.fromUtc) payload.fromUtc = params.fromUtc;
  if (params.toUtc) payload.toUtc = params.toUtc;
  return payload;
};

type ActivityFilterToolbarProps = {
  fieldErrors?: Record<string, string>;
};

const RANGE_OPTIONS: { value: ActivityRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
];

const firstErrorText = (value: string | string[] | undefined): string | undefined => {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

export const resolveFilterFieldErrors = (
  errors: Record<string, string | string[]> | undefined,
): Record<string, string> => {
  if (!errors) return {};
  const out: Record<string, string> = {};
  const config =
    firstErrorText(errors.ConfigurationId) ?? firstErrorText(errors.configurationId);
  const range =
    firstErrorText(errors.Range) ??
    firstErrorText(errors.range) ??
    firstErrorText(errors.FromUtc) ??
    firstErrorText(errors.fromUtc) ??
    firstErrorText(errors.ToUtc) ??
    firstErrorText(errors.toUtc);
  if (config) out.configurationId = config;
  if (range) out.range = range;
  return out;
};

export const ActivityFilterToolbar = ({ fieldErrors = {} }: ActivityFilterToolbarProps) => {
  const { queryParams, setQueryParams } = useSignupLinkActivityQueryParams();
  const { data, isLoading } = useGetSignupLinkConfigurations({
    page: 0,
    pageSize: 200,
    includeInactive: true,
  });
  const configurations = useMemo(() => data?.items ?? [], [data?.items]);
  const [dateOpen, setDateOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date } | undefined>();

  const selectedConfig = useMemo(
    () => configurations.find((c) => c.itemId === queryParams.configurationId),
    [configurations, queryParams.configurationId],
  );

  const customLabel = useMemo(() => {
    if (!queryParams.fromUtc && !queryParams.toUtc) return "Pick dates";
    const from = queryParams.fromUtc ? new Date(queryParams.fromUtc) : undefined;
    const to = queryParams.toUtc ? new Date(queryParams.toUtc) : undefined;
    if (from && to) return `${formatDate(from, true)} – ${formatDate(to, true)}`;
    if (from) return `From ${formatDate(from, true)}`;
    if (to) return `Until ${formatDate(to, true)}`;
    return "Pick dates";
  }, [queryParams.fromUtc, queryParams.toUtc]);

  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start"
      data-testid="activity-filter-toolbar"
    >
      <div className="flex min-w-[220px] flex-1 flex-col gap-1">
        <Label htmlFor="activity-configuration" className="text-sm font-normal">
          Configuration
        </Label>
        <Select
          value={queryParams.configurationId || undefined}
          onValueChange={(value) =>
            setQueryParams((params) => ({ ...params, configurationId: value }))
          }
          disabled={isLoading}
        >
          <SelectTrigger
            id="activity-configuration"
            className="h-9"
            data-testid="activity-configuration-select"
            aria-invalid={Boolean(fieldErrors.configurationId)}
          >
            <SelectValue placeholder="Choose a configuration" />
          </SelectTrigger>
          <SelectContent>
            {configurations.map((config: ISignupLinkConfiguration) => (
              <SelectItem key={config.itemId} value={config.itemId}>
                <span className="flex items-center gap-2">
                  <span>{config.name}</span>
                  {!config.isActive && (
                    <Badge variant="secondary" className="font-normal">
                      Archived
                    </Badge>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedConfig && !selectedConfig.isActive && (
          <span className="sr-only">Selected configuration is archived</span>
        )}
        {fieldErrors.configurationId && (
          <p className="text-xs text-destructive" data-testid="activity-configuration-error">
            {fieldErrors.configurationId}
          </p>
        )}
      </div>

      <div className="flex min-w-[180px] flex-col gap-1">
        <Label htmlFor="activity-range" className="text-sm font-normal">
          Date range
        </Label>
        <Select
          value={(queryParams.range as ActivityRange) || "30d"}
          onValueChange={(value) => {
            const range = value as ActivityRange;
            setQueryParams((params) => ({
              ...params,
              range,
              fromUtc: range === "custom" ? params.fromUtc : "",
              toUtc: range === "custom" ? params.toUtc : "",
            }));
          }}
        >
          <SelectTrigger
            id="activity-range"
            className="h-9"
            data-testid="activity-range-select"
            aria-invalid={Boolean(fieldErrors.range)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldErrors.range && (
          <p className="text-xs text-destructive" data-testid="activity-range-error">
            {fieldErrors.range}
          </p>
        )}
      </div>

      {queryParams.range === "custom" && (
        <div className="flex flex-col gap-1 pt-0 sm:pt-6">
          <Popover
            open={dateOpen}
            onOpenChange={(open) => {
              setDateOpen(open);
              if (open) {
                setDraftRange({
                  from: queryParams.fromUtc ? new Date(queryParams.fromUtc) : undefined,
                  to: queryParams.toUtc ? new Date(queryParams.toUtc) : undefined,
                });
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-dashed"
                data-testid="activity-custom-range"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {customLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={draftRange?.from}
                selected={
                  draftRange?.from ? { from: draftRange.from, to: draftRange.to } : undefined
                }
                onSelect={(selected) => {
                  if (!selected) {
                    setDraftRange(undefined);
                    return;
                  }
                  setDraftRange(selected);
                }}
                numberOfMonths={2}
              />
              <div className="flex items-center gap-4 px-3 pb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setDraftRange(undefined);
                    setQueryParams((params) => ({ ...params, fromUtc: "", toUtc: "" }));
                    setDateOpen(false);
                  }}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    setQueryParams((params) => ({
                      ...params,
                      fromUtc: draftRange?.from ? draftRange.from.toISOString() : "",
                      toUtc: draftRange?.to ? draftRange.to.toISOString() : "",
                    }));
                    setDateOpen(false);
                  }}
                >
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
};

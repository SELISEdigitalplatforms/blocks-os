import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Badge } from "@/components/ui-kits/badge/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui-kits/collapsible/collapsible";
import { cn } from "@/lib/utils";
import { EndpointRow } from "./endpoint-row";
import { SecurityPresetsPopover } from "./security-presets-popover";
import { IApiEndpoint } from "../models/api-endpoint.model";
import { SERVICE_META, DEFAULT_SERVICE_META } from "../constants/endpoint.constant";
type ServiceGroupCardProps = {
  controller: string;
  endpoints: IApiEndpoint[];
  selectedIds: Set<string>;
  onSelectEndpoint: (id: string, checked: boolean) => void;
  onSelectGroup: (ids: string[], checked: boolean) => void;
  onToggleMfa: (endpoint: IApiEndpoint, value: boolean) => void;
  onToggleCaptcha: (endpoint: IApiEndpoint, value: boolean) => void;
  onBulkGroupMfa: (ids: string[], value: boolean) => void;
  onBulkGroupCaptcha: (ids: string[], value: boolean) => void;
};
export const ServiceGroupCard = ({
  controller,
  endpoints,
  selectedIds,
  onSelectEndpoint,
  onSelectGroup,
  onToggleMfa,
  onToggleCaptcha,
  onBulkGroupMfa,
  onBulkGroupCaptcha,
}: ServiceGroupCardProps) => {
  const [open, setOpen] = useState(false);
  const meta = SERVICE_META[controller] || DEFAULT_SERVICE_META;
  const groupIds = endpoints.map((e) => e.itemId);
  const selectedCount = groupIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = selectedCount === groupIds.length && groupIds.length > 0;
  const someSelected = selectedCount > 0 && !allSelected;
  const handleGroupCheckbox = (checked: boolean) => {
    onSelectGroup(groupIds, checked);
  };
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <Checkbox
            checked={allSelected}
            // @ts-expect-error indeterminate is supported by radix but not typed
            indeterminate={someSelected ? true : undefined}
            onCheckedChange={handleGroupCheckbox}
            onClick={(e) => e.stopPropagation()}
          />
          <CollapsibleTrigger asChild>
            <button className="flex flex-1 items-center gap-2 text-left sm:gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold leading-snug sm:text-base">{controller}</h3>
                <p className="truncate text-[10px] text-muted-foreground sm:text-[11px]">{meta.description}</p>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Badge className="hidden sm:flex rounded-full font-mono text-xs bg-primary/10 text-primary pointer-events-none">
              {endpoints.length} Endpoint{endpoints.length !== 1 ? "s" : ""}
            </Badge>
            <span className="flex sm:hidden rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-primary pointer-events-none">
              {endpoints.length}
            </span>
            <SecurityPresetsPopover
              onEnableAllMfa={() => onBulkGroupMfa(groupIds, true)}
              onEnableAllCaptcha={() => onBulkGroupCaptcha(groupIds, true)}
            />
            <CollapsibleTrigger asChild>
              <button className="rounded-md p-1 transition-colors hover:bg-accent sm:p-1.5">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    open && "rotate-180",
                  )}
                />
              </button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <div className="flex flex-col gap-1.5 border-t border-border px-2 py-2 sm:px-4 sm:py-3">
            {endpoints.map((ep) => (
              <EndpointRow
                key={ep.itemId}
                endpoint={ep}
                isSelected={selectedIds.has(ep.itemId)}
                onSelect={onSelectEndpoint}
                onToggleMfa={onToggleMfa}
                onToggleCaptcha={onToggleCaptcha}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

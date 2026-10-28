import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui-kits/collapsible/collapsible";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { INotificationSubscriptionFilter } from "../../models/notification-config.model";
import { LIMITS, NOTIFICATION_TEXT } from "../../constants/notification-ui.constant";
import { HelpText } from "./form-row";

interface SubscriptionFiltersProps {
  filters: INotificationSubscriptionFilter[];
  onChange: (filters: INotificationSubscriptionFilter[]) => void;
}

let rowCounter = 0;
const newRowId = () => {
  rowCounter += 1;
  return rowCounter;
};

const EMPTY_FILTER: INotificationSubscriptionFilter = { context: "", actionName: "", value: "" };

/** Folded rows that narrow the receivers to users subscribed to a matching context. */
export function SubscriptionFilters({ filters, onChange }: Readonly<SubscriptionFiltersProps>) {
  // Rows have no id of their own, so each gets a local one to keep its input focused while editing.
  const [rowIds, setRowIds] = useState<number[]>(() => filters.map(newRowId));
  const update = (index: number, patch: Partial<INotificationSubscriptionFilter>) =>
    onChange(filters.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  const add = () => {
    setRowIds((ids) => [...ids, newRowId()]);
    onChange([...filters, EMPTY_FILTER]);
  };
  const remove = (index: number) => {
    setRowIds((ids) => ids.filter((_, i) => i !== index));
    onChange(filters.filter((_, i) => i !== index));
  };

  return (
    <Collapsible defaultOpen={filters.length > 0}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2">
          <ChevronDown className="h-4 w-4" />
          <span>{NOTIFICATION_TEXT.filterSummary}</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex flex-col gap-2">
        {filters.map((filter, index) => (
          <div
            key={rowIds[index]}
            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Input
              aria-label={NOTIFICATION_TEXT.filterContext}
              placeholder={NOTIFICATION_TEXT.filterContext}
              value={filter.context}
              onChange={(e) => update(index, { context: e.target.value })}
            />
            <Input
              aria-label={NOTIFICATION_TEXT.filterAction}
              placeholder={NOTIFICATION_TEXT.filterAction}
              value={filter.actionName}
              onChange={(e) => update(index, { actionName: e.target.value })}
            />
            <Input
              aria-label={NOTIFICATION_TEXT.filterValue}
              placeholder={NOTIFICATION_TEXT.filterValue}
              value={filter.value}
              onChange={(e) => update(index, { value: e.target.value })}
            />
            <Button type="button" variant="outline" size="xs" onClick={() => remove(index)}>
              {NOTIFICATION_TEXT.removeFilter}
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="link"
            size="xs"
            disabled={filters.length >= LIMITS.filters}
            onClick={add}
          >
            {NOTIFICATION_TEXT.addFilter}
          </Button>
        </div>
        <HelpText>{NOTIFICATION_TEXT.filterHelp}</HelpText>
      </CollapsibleContent>
    </Collapsible>
  );
}

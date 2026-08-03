import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

const DEFAULT_VISIBLE_COUNT = 8;

type ConfigTagListProps = {
  items: string[];
  emptyLabel?: string;
  className?: string;
};

export const ConfigTagList = ({ items, emptyLabel = "None", className }: ConfigTagListProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const visibleItems = expanded ? items : items.slice(0, DEFAULT_VISIBLE_COUNT);
  const hiddenCount = items.length - DEFAULT_VISIBLE_COUNT;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1.5">
        {visibleItems.map((item) => (
          <Badge
            key={item}
            variant="secondary"
            className="max-w-full truncate font-normal"
            title={item}
          >
            {item}
          </Badge>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </Button>
      ) : null}
    </div>
  );
};

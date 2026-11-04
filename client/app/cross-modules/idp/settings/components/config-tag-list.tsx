import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { useT } from "@seliseblocks/genesis-os";
import { useState } from "react";

const DEFAULT_VISIBLE_COUNT = 8;

type ConfigTagListProps = {
  items: string[];
  emptyLabel?: string;
  className?: string;
};

export const ConfigTagList = ({ items, emptyLabel, className }: ConfigTagListProps) => {
  const { t } = useT("os.idp.settings");
  const [expanded, setExpanded] = useState(false);

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground">{emptyLabel ?? t("CONFIG_TAG_LIST.NONE")}</p>
    );
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
          {expanded
            ? t("CONFIG_TAG_LIST.SHOW_LESS")
            : t("CONFIG_TAG_LIST.SHOW_MORE", { count: hiddenCount })}
        </Button>
      ) : null}
    </div>
  );
};

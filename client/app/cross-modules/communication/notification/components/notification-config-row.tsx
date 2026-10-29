import { Bell, EllipsisVertical, Inbox, Lock, Pencil, Smartphone, Trash } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { TableCell, TableRow } from "@/components/ui-kits/table/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import type { INotificationConfigRow } from "../models/notification-config.model";
import { NOTIFICATION_TEXT } from "../constants/notification-ui.constant";
import { notificationImportances } from "../constants/notification.constant";
import {
  channelFlags,
  receiversLabel,
  sendToLabel,
  serviceLabel,
} from "../utils/notification-labels";

const EMPTY = "–";

/** Importance 0 means "not set", so it shows as a dash like a missing value. */
const importanceOf = (importance?: number) =>
  notificationImportances.find((item) => item.value > 0 && item.value === importance);

/** Low = grey, Medium = blue, High = orange. */
const IMPORTANCE_VARIANT: Record<number, "secondary" | "info" | "warning"> = {
  1: "secondary",
  2: "info",
  3: "warning",
};

function ImportanceBadge({ importance }: Readonly<{ importance?: number }>) {
  const item = importanceOf(importance);
  if (!item) return <span className="text-low-emphasis">{EMPTY}</span>;
  return (
    <Badge variant={IMPORTANCE_VARIANT[item.value]} className="w-fit whitespace-nowrap font-normal">
      {item.label}
    </Badge>
  );
}

const CHANNEL_ICONS: { key: "inApp" | "push" | "inbox"; label: string; icon: LucideIcon }[] = [
  { key: "inApp", label: NOTIFICATION_TEXT.columns.inApp, icon: Bell },
  { key: "push", label: NOTIFICATION_TEXT.columns.push, icon: Smartphone },
  { key: "inbox", label: NOTIFICATION_TEXT.columns.inbox, icon: Inbox },
];

/** One icon per channel: coloured when on, faded when off. Hover or a screen reader names it. */
function DeliveryChannels({
  channels,
}: Readonly<{ channels: Record<"inApp" | "push" | "inbox", boolean> }>) {
  return (
    <div className="flex items-center gap-1.5">
      {CHANNEL_ICONS.map(({ key, label, icon: Icon }) => {
        const on = channels[key];
        const text = `${label}: ${on ? NOTIFICATION_TEXT.channelOn : NOTIFICATION_TEXT.channelOff}`;
        return (
          <span
            key={key}
            title={text}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full",
              on ? "bg-blue-50 text-blue-700" : "bg-transparent text-low-emphasis opacity-40",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{text}</span>
          </span>
        );
      })}
    </div>
  );
}

interface NotificationConfigRowProps {
  config: INotificationConfigRow;
  onEdit: (config: INotificationConfigRow) => void;
  onDelete: (config: INotificationConfigRow) => void;
}

/** One table row: name, recipients, source, the channels and status. */
export function NotificationConfigRow({
  config,
  onEdit,
  onDelete,
}: Readonly<NotificationConfigRowProps>) {
  const channels = channelFlags(config);
  return (
    <TableRow
      className="cursor-pointer"
      tabIndex={0}
      onClick={() => onEdit(config)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target === event.currentTarget) onEdit(config);
      }}
    >
      <TableCell className="min-w-[280px] max-w-[460px] py-3">
        <div className="flex items-center gap-2">
          <span className="break-all font-mono text-sm font-medium">{config.name}</span>
          {config.audienceLocked && (
            <Lock className="h-3.5 w-3.5 shrink-0" aria-label="Personal notice" />
          )}
          <Badge
            variant={config.isBuiltIn ? "secondary" : "info"}
            className="w-fit shrink-0 px-1.5 py-0 font-normal"
          >
            {config.isBuiltIn ? NOTIFICATION_TEXT.builtIn : NOTIFICATION_TEXT.custom}
          </Badge>
        </div>
        {config.description && (
          <div className="mt-0.5 text-xs text-medium-emphasis">{config.description}</div>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="text-sm">{receiversLabel(config)}</div>
        <div className="text-xs text-medium-emphasis">{sendToLabel(config)}</div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {serviceLabel(config.sourceService) || EMPTY}
      </TableCell>
      <TableCell>
        <ImportanceBadge importance={config.importance} />
      </TableCell>
      <TableCell>
        <DeliveryChannels channels={channels} />
      </TableCell>
      <TableCell>
        <Badge
          variant={config.isDisabled ? "secondary" : "success"}
          className="w-fit whitespace-nowrap font-normal"
        >
          {config.isDisabled ? NOTIFICATION_TEXT.inactive : NOTIFICATION_TEXT.active}
        </Badge>
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-5 w-5 p-0"
              aria-label={`Actions for ${config.name}`}
            >
              <EllipsisVertical width={20} height={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="cursor-pointer" onClick={() => onEdit(config)}>
              <Pencil className="mr-2 h-4 w-4" />
              <span>Edit</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer text-error"
              onClick={() => onDelete(config)}
            >
              <Trash className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

import { EllipsisVertical, Lock, Pencil, Trash } from "lucide-react";
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
import { channelFlags, receiversLabel, sendToLabel } from "../utils/notification-labels";

const YesNo = ({ value }: Readonly<{ value: boolean }>) =>
  value ? (
    <span aria-label="Yes" className="text-success">
      {"✓"}
    </span>
  ) : (
    <span aria-label="No" className="text-low-emphasis">
      {"–"}
    </span>
  );

interface NotificationConfigRowProps {
  config: INotificationConfigRow;
  onEdit: (config: INotificationConfigRow) => void;
  onDelete: (config: INotificationConfigRow) => void;
}

/** One table row: name, who it goes to, the channels and on/off. */
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
      <TableCell className="max-w-[420px]">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-sm font-medium">{config.name}</span>
          {config.audienceLocked && (
            <Lock className="h-3.5 w-3.5 shrink-0" aria-label="Personal notice" />
          )}
          {!config.isBuiltIn && (
            <Badge variant="info" className="w-fit shrink-0 px-1.5 py-0">
              {NOTIFICATION_TEXT.custom}
            </Badge>
          )}
        </div>
        {config.description && (
          <div className="truncate text-xs text-medium-emphasis" title={config.description}>
            {config.description}
          </div>
        )}
      </TableCell>
      <TableCell>{sendToLabel(config)}</TableCell>
      <TableCell>{receiversLabel(config)}</TableCell>
      <TableCell>
        <YesNo value={channels.inApp} />
      </TableCell>
      <TableCell>
        <YesNo value={channels.push} />
      </TableCell>
      <TableCell>
        <YesNo value={channels.inbox} />
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${config.isDisabled ? "bg-low-emphasis" : "bg-success"}`}
          />
          {config.isDisabled ? "Off" : "On"}
        </span>
      </TableCell>
      <TableCell onClick={(event) => event.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-5 w-5 p-0" aria-label={`Actions for ${config.name}`}>
              <EllipsisVertical width={20} height={20} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="cursor-pointer" onClick={() => onEdit(config)}>
              <Pencil className="mr-2 h-4 w-4" />
              <span>Edit</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-error" onClick={() => onDelete(config)}>
              <Trash className="mr-2 h-4 w-4" />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import type { IPushTestDevice, IPushTestResult } from "../models/push.model";
import { PLATFORM_LABEL, TEST_DIALOG_TEXT } from "../constants/push-ui.constant";
import { deviceCountText, formatDateTime, lastSeenText } from "../utils/push-format";
import { keyedDevices, resultFix } from "../utils/push-results";
import { ResultBadge } from "./push-result-badge";

function DeviceRow({ device }: Readonly<{ device: IPushTestDevice }>) {
  const fix = device.result === "delivered" ? null : resultFix(device.result);
  const seen = lastSeenText(device.lastSeenAt);
  return (
    <li className="grid grid-cols-[90px_minmax(0,1fr)_auto] items-start gap-3 border-t py-3 text-sm first:border-t-0">
      <span className="font-semibold">{PLATFORM_LABEL[device.platform]}</span>
      <div className="flex min-w-0 flex-col gap-1">
        <span>
          {device.name || TEST_DIALOG_TEXT.noName}
          {seen && ` · ${TEST_DIALOG_TEXT.lastSeen} ${seen}`}
        </span>
        {fix && <span className="text-xs text-warning-700">{fix}</span>}
      </div>
      <ResultBadge code={device.result} />
    </li>
  );
}

interface PushTestResultDialogProps {
  /** Null keeps the dialog closed. */
  result: IPushTestResult | null;
  pending: boolean;
  onSendAgain: () => void;
  onClose: () => void;
}

/** One row per device the test went to, with the result and what to do about a failure. */
export function PushTestResultDialog({
  result,
  pending,
  onSendAgain,
  onClose,
}: Readonly<PushTestResultDialogProps>) {
  const devices = result?.devices ?? [];
  return (
    <Dialog open={!!result} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{TEST_DIALOG_TEXT.title}</DialogTitle>
          <DialogDescription>
            Sent to your {deviceCountText(devices.length)} · {formatDateTime(result?.sentAt)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Badge variant="success" className="font-normal">
            {result?.delivered ?? 0} delivered
          </Badge>
          <Badge variant="error" className="font-normal">
            {result?.failed ?? 0} failed
          </Badge>
        </div>
        <ul className="flex flex-col">
          {keyedDevices(devices).map(({ key, device }) => (
            <DeviceRow key={key} device={device} />
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onSendAgain}>
            {TEST_DIALOG_TEXT.sendAgain}
          </Button>
          <Button type="button" onClick={onClose}>
            {TEST_DIALOG_TEXT.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

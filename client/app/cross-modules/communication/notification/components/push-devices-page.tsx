import { useState } from "react";
import { useDebounce } from "@seliseblocks/genesis-os/hooks";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { PageHeader } from "@/components/page-header/page-header";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { PUSH_PLATFORMS, type IPushDevice } from "../models/push.model";
import { usePushDevices, useRemovePushDevice } from "../hooks/use-push-runtime";
import { DEVICES_TEXT, PLATFORM_LABEL } from "../constants/push-ui.constant";
import { isStaleDevice, lastSeenText } from "../utils/push-format";
import { SegmentedControl } from "./notification-form/segmented-control";

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 400;
/** The filter value 0 is "All"; 1..3 are the platforms in the order of PUSH_PLATFORMS. */
const ALL = 0;

function DeviceRow({
  device,
  onRemove,
}: Readonly<{ device: IPushDevice; onRemove: (device: IPushDevice) => void }>) {
  const stale = isStaleDevice(device.lastSeenAt);
  return (
    <TableRow>
      <TableCell>{device.userName || device.userId}</TableCell>
      <TableCell>{PLATFORM_LABEL[device.platform]}</TableCell>
      <TableCell>{device.name || "—"}</TableCell>
      <TableCell className={stale ? "text-error" : undefined}>
        {lastSeenText(device.lastSeenAt)}
      </TableCell>
      <TableCell className="text-right">
        <Button type="button" variant="outline" size="xs" onClick={() => onRemove(device)}>
          {DEVICES_TEXT.remove}
        </Button>
      </TableCell>
    </TableRow>
  );
}

interface PushDevicesPageProps {
  /** Back to the Push settings. */
  onBack: () => void;
}

/** Devices the apps registered for push: platform filter with counts, user search, remove with confirm. */
export function PushDevicesPage({ onBack }: Readonly<PushDevicesPageProps>) {
  const [filter, setFilter] = useState<number>(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<IPushDevice | null>(null);
  const debounced = useDebounce(search.trim(), SEARCH_DELAY_MS);
  const platform = filter === ALL ? undefined : PUSH_PLATFORMS[filter - 1];
  const { data, isLoading, isError } = usePushDevices({
    platform,
    search: debounced || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const remove = useRemovePushDevice();

  const counts = data?.counts;
  const options = [
    { value: ALL, label: `${DEVICES_TEXT.all} ${counts?.all ?? 0}` },
    ...PUSH_PLATFORMS.map((name, index) => ({
      value: index + 1,
      label: `${PLATFORM_LABEL[name]} ${counts?.[name] ?? 0}`,
    })),
  ];
  const pages = Math.max(1, Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE));

  const confirmRemove = async () => {
    if (!target) return;
    try {
      await remove.mutateAsync(target.id);
      showSuccessToast({ description: DEVICES_TEXT.removed });
    } catch (error) {
      showErrorToast({ errors: isErrorWithErrors(error) ? error.errors : "Something went wrong" });
    } finally {
      setTarget(null);
    }
  };

  const items = data?.items ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div>
          <Button type="button" variant="link" size="xs" onClick={onBack}>
            ← {DEVICES_TEXT.back}
          </Button>
        </div>
        <PageHeader title={DEVICES_TEXT.title} description={DEVICES_TEXT.subtitle} />
      </div>
      <div className="flex max-w-[880px] flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label={DEVICES_TEXT.filter}
          options={options}
          value={filter}
          onChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        />
        <Input
          aria-label={DEVICES_TEXT.search}
          placeholder={DEVICES_TEXT.search}
          className="h-9 w-52"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </div>
      <Card className="max-w-[880px]">
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{DEVICES_TEXT.user}</TableHead>
                <TableHead>{DEVICES_TEXT.platform}</TableHead>
                <TableHead>{DEVICES_TEXT.device}</TableHead>
                <TableHead>{DEVICES_TEXT.lastSeen}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((device) => (
                <DeviceRow key={device.id} device={device} onRemove={setTarget} />
              ))}
            </TableBody>
          </Table>
        )}
        {isError && (
          <p className="px-5 py-3 text-sm text-error" role="alert">
            {DEVICES_TEXT.loadFailed}
          </p>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <p className="px-5 py-3 text-sm text-medium-emphasis">{DEVICES_TEXT.empty}</p>
        )}
      </Card>
      {pages > 1 && (
        <div className="flex max-w-[880px] items-center justify-end gap-2 text-sm">
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {DEVICES_TEXT.previous}
          </Button>
          <span>
            {page} / {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            {DEVICES_TEXT.next}
          </Button>
        </div>
      )}
      <p className="text-xs text-medium-emphasis">{DEVICES_TEXT.note}</p>
      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <ConfirmationModal
          data={{
            dialogTitle: DEVICES_TEXT.confirmTitle,
            dialogSubtitle: DEVICES_TEXT.confirmBody,
            confirmButton: DEVICES_TEXT.confirmYes,
          }}
          buttonState={{ confirm: { disable: remove.isPending } }}
          onCancel={() => setTarget(null)}
          onConfirm={() => void confirmRemove()}
        />
      </Dialog>
    </div>
  );
}

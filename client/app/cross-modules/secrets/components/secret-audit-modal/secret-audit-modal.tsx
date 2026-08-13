import { useState } from "react";
import { format } from "date-fns";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { useSecretAuditLogs } from "@/cross-modules/secrets/hooks/use-secret-management";
import { describeSecretError } from "@/cross-modules/secrets/utils/secret-error";
import {
  SECRET_AUDIT_OUTCOME,
  SECRET_AUDIT_REASON_LABEL,
  type SecretAuditLogResult,
  type SecretResult,
} from "@/cross-modules/secrets/models/secret.model";

const PAGE_SIZE = 10;

const OUTCOME_VARIANT: Record<string, "success" | "error" | "warning" | "secondary"> = {
  [SECRET_AUDIT_OUTCOME.Success]: "success",
  [SECRET_AUDIT_OUTCOME.Denied]: "error",
  [SECRET_AUDIT_OUTCOME.Failed]: "error",
  [SECRET_AUDIT_OUTCOME.PartialFailure]: "warning",
};

const formatWhen = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : format(date, "dd MMM yyyy, HH:mm:ss");
};

const AuditRow = ({ log }: { log: SecretAuditLogResult }) => (
  <TableRow>
    <TableCell className="whitespace-nowrap py-2.5 text-sm text-muted-foreground">
      {formatWhen(log.createdDate)}
    </TableCell>
    <TableCell className="py-2.5 text-sm font-medium">{log.action}</TableCell>
    <TableCell className="py-2.5 text-sm">
      <div className="flex items-center gap-1.5">
        <span className="max-w-[160px] truncate font-mono text-xs" title={log.actorUserId}>
          {log.actorUserId || "—"}
        </span>
        {log.isRootOverride && (
          // Surfaces that the access list was bypassed by a platform administrator.
          <Badge variant="info" className="gap-1 px-1.5 py-0 text-[10px]" title="Root override">
            <ShieldCheck className="h-3 w-3" />
            Admin
          </Badge>
        )}
        {log.impersonated && (
          <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
            Impersonated
          </Badge>
        )}
      </div>
    </TableCell>
    <TableCell className="py-2.5">
      <Badge variant={OUTCOME_VARIANT[log.outcome] ?? "secondary"} className="font-normal">
        {log.outcome}
      </Badge>
    </TableCell>
    <TableCell className="py-2.5 text-sm text-muted-foreground">
      {log.reason ? (SECRET_AUDIT_REASON_LABEL[log.reason] ?? log.reason) : "—"}
    </TableCell>
  </TableRow>
);

interface SecretAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secret: SecretResult;
}

/**
 * Audit trail for one secret.
 *
 * There is no Versions tab: the API stores no version history by design (no vault version is
 * persisted), so a tab for it could only ever show invented data.
 *
 * Mount this only while it is open; a fresh mount is what returns it to page one.
 */
export function SecretAuditModal({ open, onOpenChange, secret }: SecretAuditModalProps) {
  const [page, setPage] = useState(0);

  const { data, isLoading, isFetching, error } = useSecretAuditLogs(
    { secretId: secret.secretId, pageNumber: page + 1, pageSize: PAGE_SIZE },
    open,
  );

  const isBusy = isLoading || isFetching;
  const logs = data?.data ?? [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,760px)] w-[calc(100vw-1.5rem)] max-w-3xl flex-col overflow-hidden sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">Audit log — {secret.name}</DialogTitle>
          <DialogDescription className="text-left">
            Every operation on this secret, including denied attempts.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Banner variant="destructive">
            {describeSecretError(error, "Could not load the audit log.").message}
          </Banner>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold uppercase tracking-wide">When</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">
                  Action
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">
                  Actor
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">
                  Outcome
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide">
                  Reason
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isBusy ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    {Array.from({ length: 5 }).map((_column, cellIndex) => (
                      <TableCell key={cellIndex} className="py-3">
                        <Skeleton className="h-3 w-24" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length ? (
                logs.map((log) => <AuditRow key={log.auditId} log={log} />)
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {error ? "The audit log could not be loaded." : "No audit entries yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {!isBusy && totalCount > PAGE_SIZE && (
          <div className="flex items-center md:justify-end">
            <Pagination
              compact
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              onChange={setPage}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

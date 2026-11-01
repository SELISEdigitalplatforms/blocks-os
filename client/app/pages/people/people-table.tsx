import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import {
  CellContext,
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { EllipsisVertical, ArrowRightLeft, Mail, RefreshCw, User, UserMinus } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmationModal } from "@/components/confirmation-modal/confirmation-modal";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useRemoveAccess, useResendInvitation, useTransferOwnership } from "@/hooks/use-people";
import { useNavigate, useParams } from "react-router";
import { PeopleGroupedByEnvironments } from "@/models/people";
import { useProjectStore, useT, tStatic } from "@seliseblocks/genesis-os";
import { useAuthStore } from "@seliseblocks/genesis-os/store";
import { environmentOptions } from "@/constants/environment-options";
import { Badge } from "@/components/ui-kits/badge/badge";
import { PeopleStatusBadge } from "@/components/people/status-badge";
import { getUserDisplayName } from "@blocks-idp/iam/utils/user-display-name";

const KEY_COMMON_CANCEL = "common:CANCEL";

type PeopleTableProps = {
  people: PeopleGroupedByEnvironments[];
  isLoading: boolean;
  /** Resend invitation and activation both go through the invite endpoint. */
  canInvite?: boolean;
  canRemove?: boolean;
  /** Transferring ownership is never delegable, so it stays owner-only. */
  isOwner?: boolean;
};

export const PeopleTable = ({
  people,
  isLoading,
  canInvite = false,
  canRemove = false,
  isOwner: isViewerOwner = false,
}: PeopleTableProps) => {
  const { t } = useT("os.people");
  const navigate = useNavigate();
  const { tenantGroupId = "" } = useParams<{ tenantGroupId: string }>();
  const [isResendInvitationDialogOpen, setIsResendInvitationDialogOpen] = useState(false);
  const [isResendActivationDialogOpen, setIsResendActivationDialogOpen] = useState(false);
  const [isRemoveAccessDialogOpen, setIsRemoveAccessDialogOpen] = useState(false);
  const [isTransferOwnershipDialogOpen, setIsTransferOwnershipDialogOpen] = useState(false);
  const [selectedPeopleData, setSelectedPeopleData] = useState<PeopleGroupedByEnvironments | null>(
    null,
  );

  const { mutateAsync: removeAsync } = useRemoveAccess();
  const { mutateAsync: resendInvitation } = useResendInvitation();
  const { mutateAsync: transferOwnership, isPending: isTransferring } = useTransferOwnership();
  const groupId = useProjectStore().selectedTenantGroup || "";
  const viewerUserId = useAuthStore((state) => state.user?.sub);

  const openRemoveAccessDialog = (rowData: PeopleGroupedByEnvironments) => {
    setIsRemoveAccessDialogOpen(true);
    setSelectedPeopleData(rowData);
  };

  const openResendDialog = (rowData: PeopleGroupedByEnvironments) => {
    setIsResendInvitationDialogOpen(true);
    setSelectedPeopleData(rowData);
  };

  const openResendActivationDialog = (rowData: PeopleGroupedByEnvironments) => {
    setIsResendActivationDialogOpen(true);
    setSelectedPeopleData(rowData);
  };

  const openTransferOwnershipDialog = (rowData: PeopleGroupedByEnvironments) => {
    setIsTransferOwnershipDialogOpen(true);
    setSelectedPeopleData(rowData);
  };

  const onRemoveConfirm = async () => {
    try {
      if (!selectedPeopleData) return;
      const tenantIds = selectedPeopleData.sharedEnviroments
        .map((env) => env.tenantId)
        .filter((id): id is string => !!id);
      const groupId = useProjectStore.getState().selectedTenantGroup || "";

      if (!groupId || tenantIds.length === 0) return;

      const res = await removeAsync({
        email: selectedPeopleData.peopleDetails.email,
        tenantIds,
        groupId,
      });
      if (!res?.isSuccess) {
        showErrorToast({ errors: res?.errors });
        return;
      }

      showSuccessToast({ description: t("PEOPLE_TABLE.REMOVED_ACCESS_SUCCESSFULLY") });
      setIsRemoveAccessDialogOpen(false);
    } catch (error) {
      showErrorToast({ errors: error });
    }
  };

  const onConfirmResendInvitation = async () => {
    if (!selectedPeopleData) return;
    try {
      const res = await resendInvitation({
        email: selectedPeopleData.peopleDetails.email,
        groupId,
      });
      if (!res?.isSuccess) {
        showErrorToast({ errors: res?.errors });
        return;
      }
      showSuccessToast({ description: t("PEOPLE_TABLE.RESEND_INVITATION_MAIL") });
      setIsResendInvitationDialogOpen(false);
    } catch (error) {
      showErrorToast({ errors: error });
    }
  };

  const onConfirmResendActivation = async () => {
    if (!selectedPeopleData) return;
    try {
      // The first mail comes from blocks-os (a /invitation?code= link), so the resend must too.
      // The IAM resend sends a different mail with an IAM link.
      const res = await resendInvitation({
        email: selectedPeopleData.peopleDetails.email,
        groupId,
      });
      if (!res?.isSuccess) {
        showErrorToast({ errors: res?.errors });
        return;
      }
      showSuccessToast({ description: t("PEOPLE_TABLE.RESEND_ACTIVATION_MAIL") });
      setIsResendActivationDialogOpen(false);
    } catch (error) {
      showErrorToast({ errors: error });
    }
  };

  const onConfirmTransferOwnership = async () => {
    if (!selectedPeopleData) return;
    try {
      await transferOwnership({
        tenantGroupId: groupId,
        transferToUserEmail: selectedPeopleData.peopleDetails.email,
      });
      showSuccessToast({ description: t("PEOPLE_TABLE.OWNERSHIP_TRANSFERRED_SUCCESSFULLY") });
      setIsTransferOwnershipDialogOpen(false);
    } catch (error) {
      showErrorToast({ errors: error });
    }
  };

  const columns = useMemo<ColumnDef<PeopleGroupedByEnvironments>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => getUserDisplayName(row.peopleDetails),
        header: () => (
          <div className="flex w-[220px] items-center">
            <span className="font-bold text-medium-emphasis">{t("common:NAME")}</span>
          </div>
        ),
        cell: (info) => {
          const displayName = getUserDisplayName(info.row.original.peopleDetails);

          return (
            <div className="ml-2 flex items-center gap-3 sm:ml-0">
              <div className="relative flex h-8 w-8 min-w-8 items-center justify-center overflow-hidden rounded-full bg-muted">
                {info.row.original.peopleDetails.profileImageUrl ? (
                  <img
                    src={info.row.original.peopleDetails.profileImageUrl}
                    alt={displayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <span className="truncate">{displayName}</span>
              {/* Pending Invite: they were sent an invitation but have not accepted it yet. */}
              {info.row.original.sharedEnviroments.some(
                (env) => env.isInvitationSent && !env.isInvitationConfirmed,
              ) &&
                !info.row.original.sharedEnviroments.some((env) => env.isCreator) && (
                  <PeopleStatusBadge
                    status={tStatic("os.people", "PEOPLE_TABLE.PENDING_INVITE")}
                    className="w-fit bg-warning-100 px-2 py-0.5 text-[10px] text-xs font-normal text-warning-700"
                  />
                )}
              {/* Inactive: the account itself is not activated yet (no password / unverified).
                  Independent of invite acceptance — accepting an invite does not activate the account. */}
              {(info.row.original.peopleDetails.allowResendActivation ||
                info.row.original.peopleDetails.isActive === false) &&
                !info.row.original.sharedEnviroments.some((env) => env.isCreator) && (
                  <PeopleStatusBadge
                    status="Inactive"
                    className="w-fit bg-blocks-error-100 px-2 py-0.5 text-[10px] text-xs font-normal text-blocks-error-800"
                  />
                )}
            </div>
          );
        },
      },
      {
        // Role is identity, not state. It used to share the name cell with Pending Invite and
        // Inactive, which are two different kinds of fact about a person.
        //
        // Owner means IsCreator on every environment of the group; anyone else with a
        // membership row is a contributor, whatever they have or have not been granted.
        id: "role",
        header: () => (
          <div className="flex w-[110px] items-center">
            <span className="font-bold text-medium-emphasis">{t("PEOPLE_TABLE.ROLE")}</span>
          </div>
        ),
        cell: ({ row }: CellContext<PeopleGroupedByEnvironments, unknown>) => {
          const isOwner =
            row.original.sharedEnviroments.length > 0 &&
            row.original.sharedEnviroments.every((env) => env.isCreator);

          return (
            <div className="ml-2 sm:ml-0">
              <PeopleStatusBadge
                status={isOwner ? "Owner" : "Contributor"}
                className={
                  isOwner
                    ? "w-fit bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary"
                    : "w-fit bg-neutral-100 px-2 py-0.5 text-xs font-normal text-medium-emphasis dark:bg-primary/10 dark:text-primary"
                }
              />
            </div>
          );
        },
      },
      {
        id: "email",
        accessorFn: (row) => row.peopleDetails.email,
        header: () => (
          <div className="flex w-[180px] items-center">
            <span className="font-bold text-medium-emphasis">{t("common:EMAIL")}</span>
          </div>
        ),
        cell: (info) => (
          <div className="ml-2 w-[250px] truncate lowercase sm:ml-0 md:w-[300px]">
            {info.row.original.peopleDetails.email || "-"}
          </div>
        ),
      },
      {
        id: "environments",
        header: () => (
          <div className="flex w-[180px] items-center">
            <span className="font-bold text-medium-emphasis">{t("PEOPLE_TABLE.ENVIRONMENTS")}</span>
          </div>
        ),
        cell: ({ row }: CellContext<PeopleGroupedByEnvironments, unknown>) => {
          const { sharedEnviroments } = row.original;
          const totalEnvs = sharedEnviroments.length;
          const displayedEnvs = totalEnvs > 3 ? sharedEnviroments.slice(0, 2) : sharedEnviroments;
          const hasMore = totalEnvs > 3;
          const moreCount = totalEnvs - 2;

          return (
            <div className="ml-2 flex w-[180px] flex-wrap gap-1 sm:ml-0 md:w-[240px]">
              {totalEnvs > 0 ? (
                <>
                  {displayedEnvs.map((env) => {
                    const envLabel =
                      environmentOptions.find((opt) => opt.value === env.enviroment)?.label ||
                      env.enviroment;
                    return (
                      <Badge key={env.itemId} variant="secondary" className="text-xs">
                        {envLabel}
                      </Badge>
                    );
                  })}
                  {hasMore && (
                    <Badge variant="secondary" className="text-xs">
                      +{moreCount}
                    </Badge>
                  )}
                </>
              ) : (
                <span>-</span>
              )}
            </div>
          );
        },
      },
      ...(canInvite || canRemove || isViewerOwner
        ? [
            {
              id: "actions",
              cell: ({ row }: CellContext<PeopleGroupedByEnvironments, unknown>) => {
                const isRowUserOwner = row.original.sharedEnviroments.some((env) => env.isCreator);
                if (isRowUserOwner) return null;

                // A deactivated user has no actions: access cannot change and mail would bounce.
                if (row.original.peopleDetails.isActive === false) return null;

                const hasPending = row.original.sharedEnviroments.some(
                  (env) => !env.isInvitationConfirmed,
                );
                const isOwner = row.original.sharedEnviroments.some((env) => env.isCreator);
                const showResendInvite = hasPending && !isOwner && canInvite;
                const showResendActivation =
                  canInvite &&
                  row.original.peopleDetails.allowResendActivation &&
                  row.original.sharedEnviroments.some((env) => env.isInvitationConfirmed);

                // The owner row is already skipped above; never offer a person removing themselves.
                const showRemoveAccess =
                  canRemove && row.original.peopleDetails.userId !== viewerUserId;

                if (
                  !showResendInvite &&
                  !showResendActivation &&
                  !showRemoveAccess &&
                  !isViewerOwner
                )
                  return null;

                return (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">{t("PEOPLE_TABLE.OPEN_MENU")}</span>
                        <EllipsisVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {showResendInvite && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openResendDialog(row.original);
                          }}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          <span>{t("PEOPLE_TABLE.RESEND_INVITATION")}</span>
                        </DropdownMenuItem>
                      )}
                      {showResendActivation && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openResendActivationDialog(row.original);
                          }}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          <span>{t("PEOPLE_TABLE.RESEND_ACTIVATION")}</span>
                        </DropdownMenuItem>
                      )}
                      {showRemoveAccess && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openRemoveAccessDialog(row.original);
                          }}
                        >
                          <UserMinus className="mr-2 h-4 w-4" />
                          <span>{t("PEOPLE_TABLE.REMOVE_ACCESS")}</span>
                        </DropdownMenuItem>
                      )}
                      {!showResendInvite && isViewerOwner && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openTransferOwnershipDialog(row.original);
                          }}
                        >
                          <ArrowRightLeft className="mr-2 h-4 w-4" />
                          <span>{t("PEOPLE_TABLE.TRANSFER_OWNERSHIP")}</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              },
            },
          ]
        : []),
    ],
    [canInvite, canRemove, isViewerOwner, viewerUserId, t],
  );

  const table = useReactTable({
    data: people,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                {columns.map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    <Skeleton className="h-6 w-full rounded-sm" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : !people.length ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {t("PEOPLE_TABLE.NO_RESULTS_FOUND")}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() =>
                  navigate(
                    `/app/project/${tenantGroupId}/people/${row.original.peopleDetails.userId}`,
                  )
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={isRemoveAccessDialogOpen} onOpenChange={setIsRemoveAccessDialogOpen}>
        {isRemoveAccessDialogOpen && selectedPeopleData && (
          <ConfirmationModal
            onCancel={() => setIsRemoveAccessDialogOpen(false)}
            onConfirm={onRemoveConfirm}
            data={{
              dialogTitle: t("PEOPLE_TABLE.REVOKE_ACCESS"),
              dialogSubtitle: t("PEOPLE_TABLE.ARE_YOU_SURE_YOU_WANT_4", {
                peopleDetails: getUserDisplayName(selectedPeopleData.peopleDetails),
              }),
              confirmButton: t("PEOPLE_TABLE.REVOKE"),
              cancelButton: t(KEY_COMMON_CANCEL),
            }}
          />
        )}
      </Dialog>

      <Dialog open={isResendInvitationDialogOpen} onOpenChange={setIsResendInvitationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("PEOPLE_TABLE.RESEND_INVITATION")}</DialogTitle>
            <DialogDescription>
              {t("PEOPLE_TABLE.ARE_YOU_SURE_YOU_WANT", {
                email: selectedPeopleData?.peopleDetails.email ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResendInvitationDialogOpen(false)}>
              {t(KEY_COMMON_CANCEL)}
            </Button>
            <Button onClick={onConfirmResendInvitation}>{t("PEOPLE_TABLE.RESEND")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResendActivationDialogOpen} onOpenChange={setIsResendActivationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("PEOPLE_TABLE.RESEND_ACTIVATION")}</DialogTitle>
            <DialogDescription>
              {t("PEOPLE_TABLE.ARE_YOU_SURE_YOU_WANT_2", {
                email: selectedPeopleData?.peopleDetails.email ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResendActivationDialogOpen(false)}>
              {t(KEY_COMMON_CANCEL)}
            </Button>
            <Button onClick={onConfirmResendActivation}>{t("PEOPLE_TABLE.RESEND")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransferOwnershipDialogOpen} onOpenChange={setIsTransferOwnershipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("PEOPLE_TABLE.TRANSFER_OWNERSHIP")}</DialogTitle>
            <DialogDescription>
              {t("PEOPLE_TABLE.ARE_YOU_SURE_YOU_WANT_3", {
                email: selectedPeopleData?.peopleDetails.email ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTransferOwnershipDialogOpen(false)}
              disabled={isTransferring}
            >
              {t(KEY_COMMON_CANCEL)}
            </Button>
            <Button onClick={onConfirmTransferOwnership} disabled={isTransferring}>
              {isTransferring ? t("PEOPLE_TABLE.TRANSFERRING") : t("PEOPLE_TABLE.TRANSFER")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

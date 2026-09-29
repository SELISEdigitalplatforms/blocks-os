import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { User } from "@blocks-idp/iam/models/user";
import { useNavigate } from "react-router";
import { useUsersSortQueryParams } from "./users-filter-toolbar";
import { FilterControls } from "@/components/filter-toolbar";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { checkValidDate, formatDate, parseDateString } from "@/lib/utils";
import { getUserDisplayName, getUserInitials } from "@blocks-idp/iam/utils/user-display-name";
import { Users as UsersIcon } from "lucide-react";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { cn } from "@/lib/utils";

type UserTableProps = {
  users: User[];
  isLoading: boolean;
  /** When off, every prop below is ignored and the table behaves exactly as before. */
  selectionMode?: boolean;
  selectedUserIds?: Set<string>;
  onToggleUser?: (itemId: string, checked: boolean) => void;
  onToggleAllOnPage?: (checked: boolean) => void;
};

// One extra leading column while selecting, so the header and the rows stay aligned
// without either of them knowing why the other shifted.
const GRID_COLUMNS = "md:grid-cols-[200px_minmax(0,1fr)_90px_130px_140px]";
const GRID_COLUMNS_SELECTING = "md:grid-cols-[32px_200px_minmax(0,1fr)_90px_130px_140px]";

// Radix renders the same tick for "mixed" as for "checked", which would read as
// "everything is selected" when only some rows are. The tick is hidden in that state
// and replaced with a dash drawn on the box itself, so no new primitive is needed.
const INDETERMINATE_BOX =
  "relative data-[state=indeterminate]:border-blocks-primary-500 data-[state=indeterminate]:bg-blocks-primary-500 data-[state=indeterminate]:text-primary-foreground [&[data-state=indeterminate]_svg]:hidden after:absolute after:left-1/2 after:top-1/2 after:hidden after:h-[2px] after:w-2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-current data-[state=indeterminate]:after:block";

const LoadingSkelton = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 8 }).map((_, index) => (
      <Skeleton key={index} className="h-[72px] w-full rounded-xl" />
    ))}
  </div>
);

export const UsersTable = ({
  users,
  isLoading,
  selectionMode = false,
  selectedUserIds,
  onToggleUser,
  onToggleAllOnPage,
}: UserTableProps) => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { sortQueryParams, setSortQueryParams } = useUsersSortQueryParams();

  const handleRowClick = (itemId: string) => {
    // Navigating mid-selection would throw away what the operator has ticked, so
    // while selecting the row is inert and only its checkbox responds.
    if (selectionMode) return;
    navigate(scoped(`iam/user-detail/${itemId}`));
  };

  const selectedCountOnPage = selectionMode
    ? users.filter((user) => selectedUserIds?.has(user.itemId)).length
    : 0;
  const headerChecked: boolean | "indeterminate" =
    selectedCountOnPage === 0
      ? false
      : selectedCountOnPage === users.length
        ? true
        : "indeterminate";

  if (isLoading) return <LoadingSkelton />;

  if (!users.length) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl  py-16 text-center text-sm text-muted-foreground">
        <UsersIcon className="h-6 w-6" />
        No users found.
      </div>
    );
  }

  return (
    <div className="scrollbar-hidden-x overflow-x-hidden md:overflow-x-auto">
      <div className="flex flex-col gap-3 md:min-w-[940px]">
        <div
          className={cn(
            "hidden items-center gap-4 px-4 md:grid",
            selectionMode ? GRID_COLUMNS_SELECTING : GRID_COLUMNS,
          )}
        >
          {selectionMode && (
            <div className="shrink-0">
              <Checkbox
                aria-label="Select all users on this page"
                data-testid="users-select-all-on-page"
                className={INDETERMINATE_BOX}
                checked={headerChecked}
                onCheckedChange={(value) => onToggleAllOnPage?.(value === true)}
              />
            </div>
          )}
          <div className="min-w-0">
            <FilterControls.SortHeader
              id="FirstName"
              label="Name"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          </div>
          <div className="min-w-0">
            <FilterControls.SortHeader
              id="Email"
              label="Email"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          </div>
          <div className="shrink-0">
            <FilterControls.SortHeader
              id="Active"
              label="Status"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          </div>
          <div className="shrink-0">
            <FilterControls.SortHeader
              id="CreatedDate"
              label="Created on"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          </div>
          <div className="shrink-0">
            <FilterControls.SortHeader
              id="LastLoggedInTime"
              label="Last login"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          </div>
        </div>

        {users.map((user) => {
          const fullName = getUserDisplayName(user);
          const hasLastLogin = checkValidDate(user.lastLoggedInTime);
          const hasCreated = checkValidDate(user.createdDate);

          return (
            <div
              key={user.itemId}
              role="button"
              tabIndex={0}
              onClick={() => handleRowClick(user.itemId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleRowClick(user.itemId);
              }}
              className={cn(
                "group flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors md:grid md:items-center md:gap-4",
                selectionMode ? "cursor-default" : "cursor-pointer hover:border-primary/30",
                selectionMode ? GRID_COLUMNS_SELECTING : GRID_COLUMNS,
              )}
            >
              {selectionMode && (
                <div
                  className="shrink-0"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  role="presentation"
                >
                  <Checkbox
                    aria-label={`Select ${fullName}`}
                    data-testid={`users-select-${user.itemId}`}
                    checked={selectedUserIds?.has(user.itemId) ?? false}
                    onCheckedChange={(value) => onToggleUser?.(user.itemId, value === true)}
                  />
                </div>
              )}
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {getUserInitials(user)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-high-emphasis">{fullName}</p>
                  {user.email && (
                    <div className="md:hidden">
                      <CopyToClipboardButton textToCopy={user.email} isHoverable>
                        <span className="truncate text-xs lowercase text-muted-foreground">
                          {user.email}
                        </span>
                      </CopyToClipboardButton>
                    </div>
                  )}
                </div>
              </div>

              {/* The cell itself always renders: dropping it would pull the
                  status and date columns one place left for a user with no
                  email, breaking alignment with the header row. */}
              <div className="hidden min-w-0 md:block">
                {user.email && (
                  <CopyToClipboardButton textToCopy={user.email} isHoverable>
                    <span className="truncate text-sm lowercase text-muted-foreground">
                      {user.email}
                    </span>
                  </CopyToClipboardButton>
                )}
              </div>

              {/* Status + dates: grouped on one row on mobile; on md+ this
                  wrapper becomes `contents` so its children fall back into
                  their own grid columns (3-5), matching the header. */}
              <div className="flex flex-wrap items-center justify-between gap-3 md:contents">
                <div className="flex flex-wrap items-center gap-1 md:shrink-0">
                  <Badge variant={user.active ? "success" : "error"} className="w-fit">
                    {user.active ? "Active" : "Inactive"}
                  </Badge>
                  {user.isLockedOut === true && (
                    <Badge variant="error" className="w-fit">
                      Locked out
                    </Badge>
                  )}
                </div>

                <div className="text-right md:shrink-0 md:text-left md:text-sm md:text-muted-foreground">
                  <span className="block text-xs text-muted-foreground md:hidden">Created on</span>
                  {hasCreated ? formatDate(parseDateString(user.createdDate)) : "-"}
                </div>

                <div className="text-right md:shrink-0 md:text-left md:text-sm md:text-muted-foreground">
                  <span className="block text-xs text-muted-foreground md:hidden">Last login</span>
                  {hasLastLogin
                    ? formatDate(parseDateString(user.lastLoggedInTime))
                    : "Never logged in"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

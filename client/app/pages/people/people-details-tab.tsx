import { User } from "@blocks-idp/iam/models/user";
import { Card } from "@/components/ui-kits/card/card";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { checkValidDate, formatFullDate } from "@/lib/utils";

const getInitials = (user?: User) => {
  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((name) => name?.charAt(0).toUpperCase())
    .join("");

  return initials || "?";
};

export const PeopleDetailsTab = ({
  user,
  projectRole,
}: {
  user?: User;
  projectRole?: "Owner" | "Contributor";
}) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <Card className="overflow-hidden p-0">
      <div className="w-full border-b bg-card px-5 py-5 sm:px-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-[minmax(0,1.5fr)_minmax(11rem,1fr)_minmax(11rem,1fr)] md:items-center">
          <div className="flex min-w-0 items-center gap-4 sm:col-span-2 md:col-span-1">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-blocks-primary-100 text-xl font-semibold text-blocks-primary-700 shadow-sm">
              {user?.profileImageUrl ? (
                <img
                  src={user.profileImageUrl}
                  alt={`${fullName || "Member"} profile`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span aria-label="Profile initials">{getInitials(user)}</span>
              )}
            </div>
            <div className="min-w-0">
              {user?.email ? (
                <CopyToClipboardButton textToCopy={user.email}>
                  <span className="truncate text-sm font-medium text-high-emphasis">{user.email}</span>
                </CopyToClipboardButton>
              ) : (
                <span className="text-sm text-medium-emphasis">Contact information unavailable</span>
              )}
              <p className="mt-1 text-sm text-medium-emphasis">
                <span className="mr-1.5">Role:</span>
                <span className="font-medium text-high-emphasis">{projectRole ?? "Contributor"}</span>
              </p>
            </div>
          </div>

          <div className="border-t pt-4 sm:border-t-0 sm:pt-0 md:border-l md:pl-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Latest login
            </p>
            <p className="mt-1.5 text-sm font-medium text-high-emphasis">
              {user?.lastLoggedInTime && checkValidDate(user.lastLoggedInTime)
                ? formatFullDate(new Date(user.lastLoggedInTime))
                : "-"}
            </p>
          </div>
          <div className="border-t pt-4 sm:border-t-0 sm:pt-0 md:border-l md:pl-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Joined</p>
            <p className="mt-1.5 text-sm font-medium text-high-emphasis">
              {user?.createdDate && checkValidDate(user.createdDate)
                ? formatFullDate(new Date(user.createdDate))
                : "-"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

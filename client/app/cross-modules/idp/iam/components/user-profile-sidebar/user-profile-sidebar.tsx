import { useGetUserById } from "@blocks-idp/iam/hooks/use-user";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { ProfileImageUploader } from "@blocks-idp/iam/components/profile-image-uploader";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { getUserDisplayName } from "@blocks-idp/iam/utils/user-display-name";
import { formatFullDate } from "@/lib/utils";
import { Activity, Calendar, Shield } from "lucide-react";

type UserProfileSidebarProps = {
  id: string;
  projectKey: string;
};

type InfoRowProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
};

const InfoRow = ({ icon, label, value }: InfoRowProps) => (
  <div className="flex items-start gap-3 py-2.5">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value ?? "\u2014"}</div>
    </div>
  </div>
);

const formatLastLogin = (value?: string) => {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getFullYear() <= 1) return "Never";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatUtcLockoutTime = (value: string): string | null => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${formatFullDate(date, false, true)} UTC`;
};

export const UserProfileSidebar = ({ id, projectKey }: UserProfileSidebarProps) => {
  const { data, isLoading } = useGetUserById({ id, projectKey });
  const user = data?.data;
  const formattedLockoutTime = user?.lockoutUntilUtc
    ? formatUtcLockoutTime(user.lockoutUntilUtc)
    : null;

  return (
    <Card className="mt-4 flex flex-col overflow-hidden rounded-none border-0 bg-transparent px-0 py-0 shadow-none md:h-full md:min-h-0">
      {/* Reserves the same height while loading as once the name/email render, so
          this block popping in doesn't shift the mobile grid's row sizes and
          squeeze the tab-content row right after the user query resolves. */}
      {isLoading ? (
        <div className="flex w-full flex-col items-start gap-1 px-2 text-left md:hidden">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      ) : (
        user && (
          <div className="flex flex-col items-start gap-1 px-2 text-left md:hidden">
            <p className="truncate text-base font-semibold leading-tight text-foreground">
              {getUserDisplayName(user)}
            </p>
            {user?.email && (
              <CopyToClipboardButton textToCopy={user.email}>
                <span className="truncate text-sm text-muted-foreground">{user.email}</span>
              </CopyToClipboardButton>
            )}
          </div>
        )
      )}

      {/* Avatar. Smaller on mobile so it doesn't dominate the limited viewport
          height and crowd out the tab content below it; full size at md+. */}
      <div
        className="relative mx-auto mt-6 w-full max-w-[120px] shrink-0 md:mt-0 md:max-w-[220px]"
        style={{ aspectRatio: "1 / 1" }}
      >
        <ProfileImageUploader
          id={id}
          projectKey={projectKey}
          containerClassName="h-full w-full"
          className="h-full w-full max-w-none rounded-full bg-transparent shadow-none dark:bg-transparent"
        />
      </div>

      {/* Account details */}
      <CardContent className="mt-4 w-full rounded-sm border bg-card p-5 shadow-sm md:flex-1 md:overflow-y-auto">
        <h3 className="mb-3 text-base font-semibold text-high-emphasis">Account details</h3>
        <InfoRow
          icon={<Shield className="h-4 w-4 text-muted-foreground" />}
          label="Status"
          value={
            <div className="flex flex-col items-start gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    user?.active
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/15 text-red-600 dark:text-red-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      user?.active ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  />
                  {user?.active ? "Active" : "Inactive"}
                </span>
                {user?.isLockedOut === true && <Badge variant="error">Locked out</Badge>}
              </div>
              {user?.isLockedOut === true && formattedLockoutTime && (
                <span className="text-xs font-normal text-muted-foreground">
                  Locked out until {formattedLockoutTime}
                </span>
              )}
            </div>
          }
        />
        <InfoRow
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          label="Total logins"
          value={user?.logInCount ?? 0}
        />
        <InfoRow
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          label="Last login"
          value={formatLastLogin(user?.lastLoggedInTime)}
        />
      </CardContent>
    </Card>
  );
};

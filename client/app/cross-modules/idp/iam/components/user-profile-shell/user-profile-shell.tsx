import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { useQueryState } from "nuqs";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  underlineTabsListClass,
  underlineTabTriggerClass,
} from "@/components/ui-kits/tabs/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { cn } from "@/lib/utils";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { UserProfileSidebar } from "../user-profile-sidebar";
import { UpdateUser } from "@blocks-idp/iam/modules/user-management/update-user";
import { useGetUserById } from "@blocks-idp/iam/hooks/use-user";
import { getUserDisplayName } from "@blocks-idp/iam/utils/user-display-name";

export type UserProfileTab = {
  value: string;
  label: string;
  icon?: ReactNode;
  render: () => ReactNode;
  hiddenOnMobile?: boolean;
};

type UserProfileShellProps = {
  id: string;
  projectKey: string;
  defaultTab?: string;
  tabs: UserProfileTab[];
  rightSlot?: ReactNode;
  skeleton?: ReactNode;
  isLoading?: boolean;
  /**
   * Fallback height (px) of the fixed header above this shell when the real
   * header height cannot be measured yet (first paint before layout settles),
   * or for tests that render the shell without a real viewport. The live value
   * is measured from the rendered shell's offsetTop on every resize, so this
   * only acts as a safety net.
   */
  fixedHeaderOffsetPx?: number;
};

const DefaultSkeleton = () => (
  <div className="mx-auto w-full max-w-7xl p-6 md:p-8">
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[340px_1fr]">
      <div className="space-y-6">
        <Skeleton className="h-[500px] w-full rounded-2xl" />
      </div>
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  </div>
);

export const UserProfileShell = ({
  id,
  projectKey,
  defaultTab,
  tabs,
  rightSlot,
  skeleton,
  isLoading,
  fixedHeaderOffsetPx = 83,
}: UserProfileShellProps) => {
  const initialTab = defaultTab ?? tabs[0]?.value ?? "";
  const [tabId, setTabId] = useQueryState("userDetails", { defaultValue: initialTab });
  const activeTab = tabs.find((t) => t.value === tabId) ?? tabs[0];

  // The OS breadcrumb takes page-specific titles as a prop (customTitles) instead of
  // mutating the shared map, and it has no isLoadingLastItem prop.
  void isLoading;
  const breadcrumbTitles = {
    "/app/iam/user-detail": "Users",
    [`/app/iam/user-detail/${id}`]: activeTab?.label || "",
  };

  // The header above this shell is fixed and the page scrolls at the document
  // level, so the shell must fill whatever viewport-anchored height its parent
  // shells settle on (the surrounding AuthenticationConfigLayout now measures
  // and anchors itself to the viewport on mount/resize). The prop is still
  // plumbed through as a fallback for the very first paint before those
  // measurements settle, and for tests that render without a real viewport.
  const rootRef = useRef<HTMLDivElement>(null);
  const [headerOffset, setHeaderOffset] = useState<number>(fixedHeaderOffsetPx);

  useLayoutEffect(() => {
    const measure = () => {
      const node = rootRef.current;
      if (!node) return;
      const next = Math.max(0, Math.round(node.getBoundingClientRect().top));
      setHeaderOffset((prev) => (prev === next ? prev : next));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      ref={rootRef}
      data-testid="user-profile-shell"
      className="mx-auto flex w-full flex-col md:h-full md:min-h-0 md:overflow-hidden"
      style={{ ["--profile-shell-header-offset" as string]: `${headerOffset}px` }}
    >
      <div className="mb-4 hidden shrink-0 md:mb-4 md:block">
        <PageBreadcrumb breadcrumbIndex={4} customTitles={breadcrumbTitles} />
      </div>
      <Tabs value={tabId} className="flex flex-col md:min-h-0 md:flex-1">
        {/* Mobile stacks 3 auto-flow rows (dropdown, sidebar, tab content), each
            sized to its own natural content height - nothing is height-bound or
            internally scrolled, so the page itself scrolls (via the ancestor
            AuthenticationConfigLayout's scroll container) past whatever doesn't
            fit the viewport. md:grid-rows-[auto_1fr] pins row 2 (sidebar + tab
            content) to the remaining screen height for the desktop internal-scroll
            layout instead. */}
        <div className="grid grid-cols-1 gap-4 md:min-h-0 md:flex-1 md:grid-cols-[300px_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)] md:gap-x-6 md:gap-y-4 lg:gap-x-8">
          {/* Mobile header: tabs dropdown */}
          <div className="flex items-center justify-between gap-3 md:hidden">
            <Select value={tabId} onValueChange={(v) => setTabId(v)}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] border-border/60 px-2.5 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rightSlot}
          </div>

          {/* Desktop: title row + tabs */}
          <div className="hidden md:col-start-1 md:row-start-1 md:block">
            <ProfileHeading id={id} projectKey={projectKey} />
          </div>
          <div className="hidden flex-wrap items-end justify-between gap-3 md:col-start-2 md:row-start-1 md:flex">
            <TabsList className={cn(underlineTabsListClass, "w-fit")}>
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  onClick={() => setTabId(tab.value)}
                  className={cn(underlineTabTriggerClass, "gap-1.5")}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {rightSlot}
          </div>

          {/* Sidebar (col 1, row 2). Sized to its own natural content on mobile;
              fills the row's height and scrolls internally at md+. */}
          <div className="flex w-full flex-col md:col-start-1 md:row-start-2 md:h-full md:min-h-0">
            <UserProfileSidebar id={id} projectKey={projectKey} />
          </div>

          {/* Right column (col 2, row 2). Sized to its own natural content on mobile
              (the page scrolls); fills the row's height at md+, where the tab
              scroller owns its own vertical scroll so the user-detail screen stays
              anchored to the viewport and only the active tab scrolls. */}
          <div className="flex min-w-0 flex-col md:col-start-2 md:row-start-2 md:h-full md:min-h-0">
            {tabs.map((tab) => (
              <TabsContent
                key={tab.value}
                value={tab.value}
                forceMount
                className="mt-0 flex flex-col data-[state=inactive]:hidden md:h-full md:min-h-0 md:flex-1 md:overflow-y-auto"
              >
                {tab.render()}
              </TabsContent>
            ))}
            {!activeTab ? (skeleton ?? <DefaultSkeleton />) : null}
          </div>
        </div>
      </Tabs>
    </div>
  );
};

const ProfileHeading = ({ id, projectKey }: { id: string; projectKey: string }) => {
  const { data, isLoading } = useGetUserById({ id, projectKey });
  const user = data?.data;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-2">
        {/* The name fallback resolves to a placeholder dash for a user with
            neither a name nor an email, so it must not stand in for "still
            loading" as well - show a skeleton until the query settles. */}
        {isLoading ? (
          <Skeleton className="h-8 w-48" />
        ) : (
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
            {getUserDisplayName(user)}
          </h1>
        )}
        <UpdateUser id={id} projectKey={projectKey} iconOnly />
      </div>
      {user?.email && (
        <CopyToClipboardButton textToCopy={user.email}>
          <span className="truncate text-xs text-muted-foreground transition-colors hover:text-foreground">
            {user.email}
          </span>
        </CopyToClipboardButton>
      )}
    </div>
  );
};

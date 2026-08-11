import { DashboardHeader, SidebarMenuDesktop } from "@seliseblocks/genesis-os/components";
import { ImpersonationChecker, ImpersonationTerminator } from "@seliseblocks/genesis-os/guards";
import type * as React from "react";
import type { LayoutProps } from "@seliseblocks/genesis-os/layouts";
import { DashboardLayoutProvider } from "@seliseblocks/genesis-os/providers";

export interface ProjectOverviewLayoutProps extends LayoutProps {
  wrapper?: (content: React.ReactNode) => React.ReactNode;
  children?: React.ReactNode;
}

export function ProjectOverviewLayout({
  children,
  redirectPaths,
  navigationMenus,
  forwardedTo,
  wrapper,
}: ProjectOverviewLayoutProps) {
  const content = (
    <DashboardLayoutProvider isOpen={true}>
      <div className="flex w-full overflow-hidden">
        <SidebarMenuDesktop redirectPaths={redirectPaths} navigationMenus={navigationMenus} />
        <div className="flex h-screen min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardHeader
            redirectPaths={redirectPaths}
            navigationMenus={navigationMenus}
            forwardedTo={forwardedTo}
          />
          <div className="relative flex min-h-0 w-full flex-1 overflow-hidden bg-surface-app">
            <div className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden">
              {children}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayoutProvider>
  );

  return (
    <ImpersonationChecker>
      <ImpersonationTerminator>{wrapper ? wrapper(content) : content}</ImpersonationTerminator>
    </ImpersonationChecker>
  );
}

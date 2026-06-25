import { Fragment, useContext, useState } from "react";
import { ChevronRight, PanelLeft } from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { DesktopMenuItem } from "@/components/menus/desktop-menu-item";
import { SidebarCollapsedTooltip } from "@/components/menus/sidebar-collapsed-tooltip";
import { EnvironmentList } from "@/components/environment-list/environment-list";
import { Button } from "@/components/ui-kits/button/button";
import { ProjectList } from "@/components/project-list/project-list";
import { Separator } from "@/components/ui-kits/separator/separator";
import { TooltipProvider } from "@/components/ui-kits/tooltip/tooltip";
import { navigationMenus } from "@/constants/navigation-menus";
import { SECRET_MANAGEMENT_NAV_GROUPS } from "@/constants/secret-management-nav";
import { AUTHENTICATION_NAV_GROUPS } from "@/constants/authentication-nav";
import { LMT_NAV_GROUPS, LMT_BASE_PATH } from "@/constants/lmt-nav";
import { SidebarContext } from "@/contexts/dashboard-layout-provider";
import { useFilteredMenus } from "@/hooks/use-filtered-menus";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

const expandableParentClasses = (isSidebarOpen: boolean, isActive: boolean) =>
  cn(
    "group relative flex h-10 w-full cursor-pointer items-center gap-3 p-1.5 text-base text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
    isSidebarOpen ? "px-4" : "justify-center px-0",
    isActive && "!text-primary",
  );

const expandableChildClasses = (isSidebarOpen: boolean, isActive: boolean) =>
  cn(
    "group relative flex h-10 w-full cursor-pointer items-center gap-3 text-base transition-colors",
    isSidebarOpen ? "px-4 pl-8" : "justify-center px-4",
    isActive
      ? "!text-primary"
      : "text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
  );

export function SidebarMenuDesktop() {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarContext);
  const { resolvedTheme } = useTheme();
  const allowedMenu = useFilteredMenus(navigationMenus);
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isProjectOverviewRoute = pathname.startsWith("/project-overview");
  const isSecretManagementRoute = pathname.startsWith("/app/secret-management");
  const isAuthenticationRoute = pathname.startsWith("/app/idp");
  const isLmtRoute = pathname.startsWith(LMT_BASE_PATH);
  const currentTab =
    searchParams.get("tab") ??
    (isSecretManagementRoute
      ? "my-secret"
      : isAuthenticationRoute
        ? "config"
        : "my-secret");
  const [secretsOpen, setSecretsOpen] = useState(true);
  const [idpOpen, setIdpOpen] = useState(true);
  const [lmtOpen, setLmtOpen] = useState(true);

  const getLogoSrc = () => {
    if (isSidebarOpen) {
      return resolvedTheme === "dark"
        ? "/blocks-logos/os_dark_mode.svg"
        : "/blocks-logos/os_light_mode.svg";
    }
    return resolvedTheme === "dark" ? "/Icon_White.svg" : "/Icon.svg";
  };

  const renderExpandableParent = (
    menu: (typeof allowedMenu)[number] & { type: "menu" },
    isActiveRoute: boolean,
    isOpen: boolean,
    onToggle: () => void,
  ) => (
    <SidebarCollapsedTooltip label={menu.name} show={!isSidebarOpen}>
      <button
        onClick={onToggle}
        className={expandableParentClasses(isSidebarOpen, isActiveRoute)}>
        {menu.icon ? <menu.icon className="h-5 w-5 shrink-0" /> : null}
        {isSidebarOpen && (
          <>
            <span>{menu.name}</span>
            <ChevronRight
              className={cn(
                "ml-auto h-4 w-4 transition-transform",
                isOpen && "rotate-90",
              )}
            />
          </>
        )}
        {isActiveRoute ? (
          <div className="absolute right-0 top-2.5 h-5 w-1 rounded-lg bg-primary" />
        ) : null}
      </button>
    </SidebarCollapsedTooltip>
  );

  const renderExpandableChildren = (
    groups: typeof SECRET_MANAGEMENT_NAV_GROUPS,
    routePrefix: string,
  ) => (
    <div className="grid gap-0.5">
      {groups.map((group) =>
        group.items.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.value;
          return (
            <SidebarCollapsedTooltip
              key={item.id}
              label={item.label}
              show={!isSidebarOpen}>
              <button
                onClick={() => navigate(`${routePrefix}?tab=${item.value}`)}
                className={expandableChildClasses(isSidebarOpen, isActive)}>
                <Icon className="h-5 w-5 shrink-0" />
                {isSidebarOpen && <span>{item.label}</span>}
                {isActive ? (
                  <div className="absolute right-0 top-2.5 h-5 w-1 rounded-lg bg-primary" />
                ) : null}
              </button>
            </SidebarCollapsedTooltip>
          );
        }),
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "hidden h-[calc(100vh)] shrink-0 flex-col border-r bg-background transition-all md:flex",
          isSidebarOpen ? "w-60 overflow-hidden" : "w-14 overflow-visible",
        )}>
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b bg-background px-3">
          <Link
            to="/console"
            className={cn(
              "relative inline-block cursor-pointer overflow-hidden transition-all",
              isSidebarOpen ? "h-[36px] w-[72px]" : "h-8 w-8",
            )}>
            <img
              src={getLogoSrc()}
              alt="Logo"
              className="h-full w-full object-contain"
            />
          </Link>
          {isSidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 p-0"
              onClick={toggleSidebar}>
              <PanelLeft className="h-6 w-6" />
            </Button>
          )}
        </div>
        {!isProjectOverviewRoute &&
          (isSidebarOpen ? (
            <div className="border-b px-2 pb-2 pt-2">
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Workspace
              </p>
              <div className="space-y-0.5">
                <ProjectList />
                <EnvironmentList />
              </div>
            </div>
          ) : (
            <div className="border-b py-1">
              <ProjectList collapsed />
              <EnvironmentList collapsed />
            </div>
          ))}
        <div
          className={cn(
            "w-full flex-1",
            isSidebarOpen ? "overflow-y-auto" : "overflow-visible",
          )}>
          <nav className={cn("grid w-full items-start gap-1 text-sm")}>
            {allowedMenu.map((menu) => (
              <Fragment key={menu.id}>
                {menu.type === "menu" ? (
                  <>
                    {menu.id === "service-identity__secret-management" ? (
                      <>
                        {renderExpandableParent(
                          menu,
                          isSecretManagementRoute,
                          secretsOpen,
                          () => {
                            if (!isSecretManagementRoute) {
                              navigate("/app/secret-management/my-secret");
                              setSecretsOpen(true);
                            } else {
                              setSecretsOpen((v) => !v);
                            }
                          },
                        )}
                        {isSecretManagementRoute &&
                          secretsOpen &&
                          renderExpandableChildren(
                            SECRET_MANAGEMENT_NAV_GROUPS,
                            "/app/secret-management",
                          )}
                      </>
                    ) : menu.id === "service-identity__authentication" ? (
                      <>
                        {renderExpandableParent(
                          menu,
                          isAuthenticationRoute,
                          idpOpen,
                          () => {
                            if (!isAuthenticationRoute) {
                              navigate("/app/idp/config");
                              setIdpOpen(true);
                            } else {
                              setIdpOpen((v) => !v);
                            }
                          },
                        )}
                        {isAuthenticationRoute &&
                          idpOpen &&
                          renderExpandableChildren(
                            AUTHENTICATION_NAV_GROUPS,
                            "/app/idp",
                          )}
                      </>
                    ) : menu.id === "service-identity__lmt" ? (
                      <>
                        {renderExpandableParent(
                          menu,
                          isLmtRoute,
                          lmtOpen,
                          () => {
                            if (!isLmtRoute) {
                              navigate(`${LMT_BASE_PATH}/usage`);
                              setLmtOpen(true);
                            } else {
                              setLmtOpen((v) => !v);
                            }
                          },
                        )}
                        {isLmtRoute &&
                          lmtOpen &&
                          renderExpandableChildren(
                            LMT_NAV_GROUPS,
                            LMT_BASE_PATH,
                          )}
                      </>
                    ) : (
                      <DesktopMenuItem
                        menu={menu}
                        isSidebarOpen={isSidebarOpen}
                      />
                    )}
                  </>
                ) : (
                  <Separator />
                )}
              </Fragment>
            ))}
          </nav>
        </div>
      </div>
    </TooltipProvider>
  );
}

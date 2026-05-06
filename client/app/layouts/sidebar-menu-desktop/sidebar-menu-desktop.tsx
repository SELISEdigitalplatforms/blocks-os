import { Fragment, useContext, useState } from "react";
import { ChevronRight, PanelLeft } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { DesktopMenuItem } from "@/components/menus/desktop-menu-item";
import { EnvironmentList } from "@/components/environment-list/environment-list";
import { Button } from "@/components/ui-kits/button/button";
import { ProjectList } from "@/components/project-list/project-list";
import { Separator } from "@/components/ui-kits/separator/separator";
import { navigationMenus } from "@/constants/navigation-menus";
import { SECRET_MANAGEMENT_NAV_GROUPS } from "@/constants/secret-management-nav";
import { AUTHENTICATION_NAV_GROUPS } from "@/constants/authentication-nav";
import { SidebarContext } from "@/contexts/dashboard-layout-provider";
import { useFilteredMenus } from "@/hooks/use-filtered-menus";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
export function SidebarMenuDesktop() {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarContext);
  const { resolvedTheme } = useTheme();
  const allowedMenu = useFilteredMenus(navigationMenus);
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isProjectOverviewRoute = pathname.startsWith("/project-overview");
  const isSecretManagementRoute = pathname.startsWith("/services/secret-management");
  const isAuthenticationRoute = pathname.startsWith("/services/authentication");
  const currentTab = searchParams.get("tab") ?? (isSecretManagementRoute ? "infra-config" : "general");
  const [secretsOpen, setSecretsOpen] = useState(true);
  const [idpOpen, setIdpOpen] = useState(true);
  const getLogoSrc = () => {
    if (isSidebarOpen) {
      return resolvedTheme === "dark" ? "/Logo_White.svg" : "/Logo.svg";
    }
    return resolvedTheme === "dark" ? "/Icon_White.svg" : "/Icon.svg";
  };
  return (
    <div
      className={`hidden h-[calc(100vh)] flex-col border-r bg-background transition-all md:flex ${isSidebarOpen ? "w-60 overflow-hidden" : "w-14"}`}
    >
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b bg-background px-3">
        <Link
          to="/console"
          className={cn(
            "relative inline-block cursor-pointer overflow-hidden transition-all",
            isSidebarOpen ? "h-[36px] w-[72px]" : "h-8 w-8"
          )}
        >
          <img src={getLogoSrc()} alt="Logo" className="h-full w-full object-contain" />
        </Link>
        {isSidebarOpen && (
          <Button variant="ghost" size="icon" className="shrink-0 p-0" onClick={toggleSidebar}>
            <PanelLeft className="h-6 w-6" />
          </Button>
        )}
      </div>
      {!isProjectOverviewRoute && (isSidebarOpen ? (
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
      <div className="flex-1 overflow-auto">
        <nav className={cn("grid w-full items-start gap-1 pt-1 pb-3 text-sm")}>
          {allowedMenu.map((menu) => (
            <Fragment key={menu.id}>
              {menu.type === "menu" ? (
                <>
                  {menu.id === "service-identity__secret-management" ? (
                    <button
                      onClick={() => {
                        if (!isSecretManagementRoute) {
                          navigate("/services/secret-management?tab=infra-config");
                          setSecretsOpen(true);
                        } else {
                          setSecretsOpen((v) => !v);
                        }
                      }}
                      className={cn(
                        "group relative flex cursor-pointer items-center transition-colors",
                        isSidebarOpen ? "mx-2 h-9 gap-2.5 rounded-md px-3 text-sm" : "h-10 w-full justify-center",
                        isSecretManagementRoute
                          ? isSidebarOpen
                            ? "bg-primary/10 text-primary"
                            : "text-primary"
                          : "text-[hsl(var(--low-emphasis))] hover:bg-accent hover:text-[hsl(var(--high-emphasis))]",
                      )}
                    >
                      {menu.icon && <menu.icon className="h-[18px] w-[18px] shrink-0" />}
                      {isSidebarOpen && (
                        <>
                          <span>{menu.name}</span>
                          <ChevronRight className={cn("ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform", secretsOpen && "rotate-90")} />
                        </>
                      )}
                      {!isSidebarOpen && (
                        <div className="pointer-events-none absolute left-full top-0 z-20 ml-2 min-w-max whitespace-nowrap rounded bg-gray-300 px-2 py-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                          {menu.name}
                        </div>
                      )}
                    </button>
                  ) : menu.id === "service-identity__authentication" ? (
                    <button
                      onClick={() => {
                        if (!isAuthenticationRoute) {
                          navigate("/services/authentication?tab=general");
                          setIdpOpen(true);
                        } else {
                          setIdpOpen((v) => !v);
                        }
                      }}
                      className={cn(
                        "group relative flex cursor-pointer items-center transition-colors",
                        isSidebarOpen ? "mx-2 h-9 gap-2.5 rounded-md px-3 text-sm" : "h-10 w-full justify-center",
                        isAuthenticationRoute
                          ? isSidebarOpen
                            ? "bg-primary/10 text-primary"
                            : "text-primary"
                          : "text-[hsl(var(--low-emphasis))] hover:bg-accent hover:text-[hsl(var(--high-emphasis))]",
                      )}
                    >
                      {menu.icon && <menu.icon className="h-[18px] w-[18px] shrink-0" />}
                      {isSidebarOpen && (
                        <>
                          <span>{menu.name}</span>
                          <ChevronRight className={cn("ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform", idpOpen && "rotate-90")} />
                        </>
                      )}
                      {!isSidebarOpen && (
                        <div className="pointer-events-none absolute left-full top-0 z-20 ml-2 min-w-max whitespace-nowrap rounded bg-gray-300 px-2 py-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                          {menu.name}
                        </div>
                      )}
                    </button>
                  ) : (
                    <DesktopMenuItem menu={menu} isSidebarOpen={isSidebarOpen} />
                  )}
                  {isSecretManagementRoute && menu.id === "service-identity__secret-management" && secretsOpen && (
                    <div className={cn("grid gap-0.5", isSidebarOpen ? "pl-3 pr-2" : "")}>
                      {SECRET_MANAGEMENT_NAV_GROUPS.map((group) =>
                        group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = currentTab === item.value;
                          return (
                            <div key={item.id} className="group relative">
                              <button
                                onClick={() => navigate(`/services/secret-management?tab=${item.value}`)}
                                className={cn(
                                  "relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-md text-sm transition-colors",
                                  isSidebarOpen ? "px-3" : "justify-center",
                                  isActive
                                    ? "text-primary"
                                    : "text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
                                )}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                                {isSidebarOpen && <span>{item.label}</span>}
                                {isActive && isSidebarOpen && (
                                  <div className="absolute right-3 h-2 w-2 rounded-full bg-primary" />
                                )}
                              </button>
                              {!isSidebarOpen && (
                                <div className="pointer-events-none absolute left-full top-0 z-20 ml-2 min-w-max rounded bg-gray-300 px-2 py-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                                  {item.label}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                  {isAuthenticationRoute && menu.id === "service-identity__authentication" && idpOpen && (
                    <div className={cn("grid gap-0.5", isSidebarOpen ? "pl-3 pr-2" : "")}>
                      {AUTHENTICATION_NAV_GROUPS.map((group) =>
                        group.items.map((item) => {
                          const Icon = item.icon;
                          const isActive = currentTab === item.value;
                          return (
                            <div key={item.id} className="group relative">
                              <button
                                onClick={() => navigate(`/services/authentication?tab=${item.value}`)}
                                className={cn(
                                  "relative flex h-8 w-full cursor-pointer items-center gap-2 rounded-md text-sm transition-colors",
                                  isSidebarOpen ? "px-3" : "justify-center",
                                  isActive
                                    ? "text-primary"
                                    : "text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
                                )}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                                {isSidebarOpen && <span>{item.label}</span>}
                                {isActive && isSidebarOpen && (
                                  <div className="absolute right-3 h-2 w-2 rounded-full bg-primary" />
                                )}
                              </button>
                              {!isSidebarOpen && (
                                <div className="pointer-events-none absolute left-full top-0 z-20 ml-2 min-w-max rounded bg-gray-300 px-2 py-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100">
                                  {item.label}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="mx-3 mt-0.5">
                  <Separator />
                </div>
              )}
            </Fragment>
          ))}
        </nav>
      </div>
    </div>
  );
}
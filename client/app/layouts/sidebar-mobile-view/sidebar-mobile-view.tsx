import { Fragment, useState } from "react"
import { Menu, X, ChevronRight, ChevronsLeft } from "lucide-react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { EnvironmentList } from "@/components/environment-list/environment-list"
import { Logo } from "@/components/logo"
import { MobileMenuItem } from "@/components/menus/mobile-menu-item"
import { ProjectList } from "@/components/project-list/project-list"
import { Button } from "@/components/ui-kits/button/button"
import { Separator } from "@/components/ui-kits/separator/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui-kits/sheet/sheet"
import { navigationMenus } from "@/constants/navigation-menus"
import { useFilteredMenus } from "@/hooks/use-filtered-menus"
import { SECRET_MANAGEMENT_NAV_GROUPS, NavGroup } from "@/constants/secret-management-nav"
import { AUTHENTICATION_NAV_GROUPS } from "@/constants/authentication-nav"
import { LMT_NAV_GROUPS, LMT_BASE_PATH } from "@/constants/lmt-nav"
import { cn } from "@/lib/utils"

export function SidebarMobileView() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const allowedMenu = useFilteredMenus(navigationMenus)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isProjectOverviewRoute = pathname.startsWith("/project-overview")
  const isSecretManagementRoute = pathname.startsWith("/services/secret-management")
  const isAuthenticationRoute = pathname.startsWith("/services/authentication")
  const isLmtRoute = pathname.startsWith(LMT_BASE_PATH)

  const currentTab =
    searchParams.get("tab") ??
    (isSecretManagementRoute ? "my-secret" : isAuthenticationRoute ? "config" : "my-secret")

  const MobileGroupedMenuItem = ({
    menu,
    groups,
    routePrefix,
  }: {
    menu: (typeof allowedMenu)[number] & { type: "menu" }
    groups: NavGroup[]
    routePrefix: string
  }) => {
    const isActiveMenu = pathname.startsWith(menu.path)
    return (
      <Sheet>
        <SheetTrigger asChild>
          <div
            className={cn(
              "flex h-10 cursor-pointer items-center justify-between px-4 py-1.5 text-base text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
              isActiveMenu && "!text-primary",
            )}
          >
            <div className="flex items-center gap-3">
              {menu.icon ? <menu.icon className="h-5 w-5" /> : null}
              <span className="relative">{menu.name}</span>
            </div>
            <ChevronRight className="aspect-square w-4" />
          </div>
        </SheetTrigger>
        <SheetContent className="w-full p-0 flex flex-col" aria-describedby={undefined} hideClose>
          <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3 shrink-0">
            <SheetTitle className="text-sm font-semibold">{menu.name}</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="!mt-0 h-7 w-7 shrink-0">
                <ChevronsLeft className="h-4 w-4" />
                <span className="sr-only">Close sidebar</span>
              </Button>
            </SheetClose>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-1">
            {groups.map((group) => (
              <Fragment key={group.label}>
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname.startsWith(routePrefix) && currentTab === item.value
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        navigate(`${routePrefix}?tab=${item.value}`)
                        setOpen(false) // Close the main sidebar too
                      }}
                      className={cn(
                        "relative flex h-10 w-full cursor-pointer items-center gap-3 px-4 py-1.5 text-sm transition-colors",
                        isActive
                          ? "text-primary"
                          : "text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                      {isActive && (
                        <div className="absolute right-0 top-2.5 h-5 w-1 rounded-l-lg bg-primary" />
                      )}
                    </button>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full overflow-y-auto p-0" aria-describedby={undefined} hideClose>
        <SheetHeader className="h-[60px] px-4 py-3">
          <SheetTitle className="flex items-center justify-between">
            <Link to="/console" onClick={() => setOpen(false)}>
              <Logo width={72} height={36} className="h-9 w-auto" />
            </Link>
            <SheetClose className="!mt-0">
              <X className="h-4 w-4" />
            </SheetClose>
          </SheetTitle>
        </SheetHeader>
        <Separator />
        {!isProjectOverviewRoute && (
          <div className="border-b px-2 pb-2 pt-2">
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspace
            </p>
            <div className="space-y-0.5">
              <ProjectList />
              <EnvironmentList />
            </div>
          </div>
        )}
        <nav className="grid gap-2 py-2">
          {allowedMenu.map((menu) => (
            <Fragment key={menu.id}>
              {menu.type === "menu" ? (
                <>
                  {menu.id === "service-identity__secret-management" ? (
                    <MobileGroupedMenuItem
                      menu={menu}
                      groups={SECRET_MANAGEMENT_NAV_GROUPS}
                      routePrefix="/services/secret-management"
                    />
                  ) : menu.id === "service-identity__authentication" ? (
                    <MobileGroupedMenuItem
                      menu={menu}
                      groups={AUTHENTICATION_NAV_GROUPS}
                      routePrefix="/services/authentication"
                    />
                  ) : menu.id === "service-identity__lmt" ? (
                    <MobileGroupedMenuItem
                      menu={menu}
                      groups={LMT_NAV_GROUPS}
                      routePrefix={LMT_BASE_PATH}
                    />
                  ) : (
                    <MobileMenuItem menu={menu} onClick={() => setOpen(false)} />
                  )}
                </>
              ) : (
                <Separator />
              )}
            </Fragment>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

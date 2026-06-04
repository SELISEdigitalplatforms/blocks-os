import { Fragment, useState } from "react"
import { ChevronRight, Menu, X } from "lucide-react"
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
import { SECRET_MANAGEMENT_NAV_GROUPS } from "@/constants/secret-management-nav"
import { AUTHENTICATION_NAV_GROUPS } from "@/constants/authentication-nav"
import { LMT_NAV_GROUPS } from "@/constants/lmt-nav"
import { cn } from "@/lib/utils"

const expandableParentClasses = (isActive: boolean) =>
  cn(
    "group relative flex h-10 w-full cursor-pointer items-center gap-3 px-4 py-1.5 text-base text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
    isActive && "!text-primary",
  )

const expandableChildClasses = (isActive: boolean) =>
  cn(
    "group relative flex h-10 w-full cursor-pointer items-center gap-3 px-4 pl-8 text-base transition-colors",
    isActive ? "!text-primary" : "text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
  )

export function SidebarMobileView() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const allowedMenu = useFilteredMenus(navigationMenus)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isProjectOverviewRoute = pathname.startsWith("/project-overview")
  const isSecretManagementRoute = pathname.startsWith("/services/secret-management")
  const isAuthenticationRoute = pathname.startsWith("/services/authentication")
  const isLmtRoute = pathname.startsWith("/services/lmt")

  const currentTab = searchParams.get("tab") ?? (isSecretManagementRoute ? "my-secret" : "general")
  const [secretsOpen, setSecretsOpen] = useState(true)
  const [idpOpen, setIdpOpen] = useState(true)
  const [lmtOpen, setLmtOpen] = useState(true)

  const renderExpandableParent = (
    menu: (typeof allowedMenu)[number] & { type: "menu" },
    isActiveRoute: boolean,
    isOpen: boolean,
    onToggle: () => void,
  ) => (
    <button onClick={onToggle} className={expandableParentClasses(isActiveRoute)}>
      {menu.icon ? <menu.icon className="h-5 w-5 shrink-0" /> : null}
      <span>{menu.name}</span>
      <ChevronRight className={cn("ml-auto h-4 w-4 transition-transform", isOpen && "rotate-90")} />
      {isActiveRoute ? <div className="absolute right-0 top-2.5 h-5 w-1 rounded-lg bg-primary" /> : null}
    </button>
  )

  const renderExpandableChildren = (
    groups: typeof SECRET_MANAGEMENT_NAV_GROUPS,
    routePrefix: string,
  ) => (
    <div className="grid gap-0.5">
      {groups.map((group) =>
        group.items.map((item) => {
          const Icon = item.icon
          const isActive = currentTab === item.value
          return (
            <button
              key={item.id}
              onClick={() => {
                navigate(`${routePrefix}?tab=${item.value}`)
                setOpen(false)
              }}
              className={expandableChildClasses(isActive)}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
              {isActive ? <div className="absolute right-0 top-2.5 h-5 w-1 rounded-lg bg-primary" /> : null}
            </button>
          )
        }),
      )}
    </div>
  )

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
                    <>
                      {renderExpandableParent(menu, isSecretManagementRoute, secretsOpen, () => {
                        if (!isSecretManagementRoute) {
                          navigate("/services/secret-management?tab=my-secret")
                          setOpen(false)
                        } else {
                          setSecretsOpen((v) => !v)
                        }
                      })}
                      {isSecretManagementRoute && secretsOpen &&
                        renderExpandableChildren(SECRET_MANAGEMENT_NAV_GROUPS, "/services/secret-management")}
                    </>
                  ) : menu.id === "service-identity__authentication" ? (
                    <>
                      {renderExpandableParent(menu, isAuthenticationRoute, idpOpen, () => {
                        if (!isAuthenticationRoute) {
                          navigate("/services/authentication?tab=general")
                          setOpen(false)
                        } else {
                          setIdpOpen((v) => !v)
                        }
                      })}
                      {isAuthenticationRoute && idpOpen &&
                        renderExpandableChildren(AUTHENTICATION_NAV_GROUPS, "/services/authentication")}
                    </>
                  ) : menu.id === "service-identity__lmt" ? (
                    <>
                      {renderExpandableParent(menu, isLmtRoute, lmtOpen, () => {
                        if (!isLmtRoute) {
                          navigate("/services/lmt?tab=usage")
                          setOpen(false)
                        } else {
                          setLmtOpen((v) => !v)
                        }
                      })}
                      {isLmtRoute && lmtOpen && renderExpandableChildren(LMT_NAV_GROUPS, "/services/lmt")}
                    </>
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

import { useLayoutEffect, useRef, useState } from "react";
import { AUTHENTICATION_NAV_GROUPS } from "@/constants/authentication-nav";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { EmailConfiguration } from "@blocks-communication/mail/email/email-configure/email-configure";
import { Settings } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { Link, Outlet, useLocation } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { PrimaryButton } from "@/components/action-buttons/primary-button";
import { AddRole } from "@blocks-idp/iam/modules/role-management";
import {
  AddOrganization,
  OrganizationConfig,
} from "@blocks-idp/iam/modules/organization-management";
import { InviteUser } from "@blocks-idp/iam/modules/user-management";

export const AuthenticationConfigLayout = () => {
  const { pathname } = useLocation();
  const scoped = useScopedPath();
  const currentPath = pathname.split("/").pop() ?? "config";

  // Shared via URL — the email-template child route reads the same key to know when to open
  const [configureOpen, setConfigureOpen] = useQueryState(
    "configure",
    parseAsBoolean.withDefault(false),
  );

  const currentItem = AUTHENTICATION_NAV_GROUPS.flatMap((g) => g.items).find(
    (item) => item.value === currentPath,
  );

  const isSettingsPath = currentPath === "config";

  // The shell above this layout (e.g. DashboardLayout/ConsoleLayout) doesn't
  // always give us a definite height to resolve `h-full` against, which left
  // the inner scroll container free to grow with the Outlet content and push
  // the whole page into document-level scroll. Measure the distance from the
  // top of the viewport to this layout's root on mount and on every resize —
  // that distance is whatever fixed chrome (global header, breadcrumbs, etc.)
  // sits above the auth shell, and the layout should hug the remaining viewport.
  const rootRef = useRef<HTMLDivElement>(null);
  const [topOffset, setTopOffset] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      const node = rootRef.current;
      if (!node) return;
      const next = Math.max(0, Math.round(node.getBoundingClientRect().top));
      setTopOffset((prev) => (prev === next ? prev : next));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const headerActions = (
    <>
      {currentPath === "users" && <InviteUser />}
      {currentPath === "organizations" && (
        <>
          <OrganizationConfig />
          <AddOrganization />
        </>
      )}
      {currentPath === "roles" && <AddRole />}
      {currentPath === "permissions" && (
        <Link to={scoped("iam/permission-detail/new")}>
          <PrimaryButton label="Add Permission" />
        </Link>
      )}
      {currentPath === "email-template" && (
        <Button
          variant="outline"
          size="default"
          className="gap-1 text-sm font-medium"
          onClick={() => setConfigureOpen(true)}
        >
          <Settings className="h-5 w-5" />
          <span className="sr-only sm:not-sr-only">Configure</span>
        </Button>
      )}
    </>
  );

  return (
    <>
      <div
        ref={rootRef}
        className="flex min-h-0 flex-col overflow-hidden"
        style={
          topOffset
            ? { height: `calc(100vh - ${topOffset}px)` }
            : undefined
        }
      >
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {!isSettingsPath && currentItem && (
            <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="space-y-1">
                <h1 className="text-xl font-semibold tracking-tight text-[hsl(var(--high-emphasis))] sm:text-2xl">
                  {currentItem.label}
                </h1>
                <p className="text-sm text-muted-foreground">{currentItem.desc}</p>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2">{headerActions}</div>
            </header>
          )}
          <Outlet />
        </div>
      </div>

      <Dialog open={configureOpen ?? false} onOpenChange={(open) => setConfigureOpen(open)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Configuration</DialogTitle>
          </DialogHeader>
          <EmailConfiguration />
        </DialogContent>
      </Dialog>
    </>
  );
};

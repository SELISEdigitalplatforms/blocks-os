import { ReactNode } from "react";
import { Link } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Button } from "@/components/ui-kits/button/button";
import { Settings2 } from "lucide-react";

interface OrganizationConfigProps {
  trigger?: ReactNode;
}

/**
 * Links to the organization-config tab of the IAM settings page.
 *
 * In blocks-iam the equivalent control hops to the OS app over SSO. Inside OS the
 * settings page is local, so this is a plain in-app link instead.
 */
export const OrganizationConfig = ({ trigger }: OrganizationConfigProps) => {
  const scoped = useScopedPath();
  const to = `${scoped("iam/settings")}?settingsTab=organization-config`;

  const defaultTrigger = (
    <Button size="sm" variant="outline" className="gap-2">
      <Settings2 className="h-4 w-4" />
      <span className="sr-only sm:not-sr-only">Configure Organization</span>
    </Button>
  );

  return (
    <Link to={to} className="inline-flex">
      {trigger ?? defaultTrigger}
    </Link>
  );
};

import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useT } from "@seliseblocks/genesis-os";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui-kits/breadcrumb/breadcrumb";
import { Button } from "@/components/ui-kits/button/button";
import { navText } from "@/constants/nav-text";
import { WEBHOOKS_I18N_MODULE } from "../constants/webhooks.constant";

export const SECRET_MANAGEMENT_PATH = "secret-management";
export const WEBHOOKS_LIST_PATH = "secret-management/webhooks";

/**
 * Where the detail page sits: a breadcrumb from md up, an icon back button below.
 * The section names are the sidebar's own texts, so both always read the same.
 */
export function WebhookDetailsNav({ name }: Readonly<{ name?: string }>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const scoped = useScopedPath();
  const navigate = useNavigate();

  return (
    <>
      <div className="hidden md:flex">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={scoped(SECRET_MANAGEMENT_PATH)}>
                  {navText("NAVIGATION_MENUS.SECRETS_CONFIGS")}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={scoped(WEBHOOKS_LIST_PATH)}>
                  {navText("SECRET_MANAGEMENT_NAV.WEBHOOKS")}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {name ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="truncate">{name}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("DETAILS.BACK")}
          onClick={() => navigate(scoped(WEBHOOKS_LIST_PATH))}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}

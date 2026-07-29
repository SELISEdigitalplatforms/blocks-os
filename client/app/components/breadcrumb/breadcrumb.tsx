import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui-kits/breadcrumb/breadcrumb";
import { Link, useLocation } from "react-router";
import { usePathSegments } from "@seliseblocks/genesis-os/hooks";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { cn } from "@/lib/utils";

export type BreadcrumbTitles = Record<string, string | null>;

const normalizeBreadcrumbHref = (href: string): string =>
  href.replace(/^\/app\/[^/]+(?=\/)/, "/app");

const getBreadcrumbTitle = (
  href: string,
  defaultLabel: string,
  titles: BreadcrumbTitles,
): string | null => {
  const normalizedHref = normalizeBreadcrumbHref(href);
  if (Object.prototype.hasOwnProperty.call(titles, normalizedHref)) {
    return titles[normalizedHref];
  }
  if (Object.prototype.hasOwnProperty.call(titles, href)) {
    return titles[href];
  }
  return defaultLabel;
};

const getBreadcrumbLinkHref = (href: string): string => {
  const normalizedHref = normalizeBreadcrumbHref(href);
  if (normalizedHref === "/app/idp/role-detail") {
    return href.replace("/idp/role-detail", "/idp/roles");
  }
  if (normalizedHref === "/app/idp/permission-detail") {
    return href.replace("/idp/permission-detail", "/idp/permissions");
  }
  return href;
};

const PageBreadcrumb: React.FC<{
  breadcrumbIndex?: number;
  disabledHrefs?: string[];
  className?: string;
  listClassName?: string;
  /**
   * Page-specific titles, merged over the shared defaults. Pages own the titles for
   * their own segments; passing them down keeps render pure (see react-hooks/immutability)
   * instead of mutating the shared map.
   */
  customTitles?: BreadcrumbTitles;
}> = ({ breadcrumbIndex, disabledHrefs = [], className, listClassName, customTitles }) => {
  const { pathname } = useLocation();
  const titles = customTitles
    ? { ...BREADCRUMB_CUSTOM_TITLES, ...customTitles }
    : BREADCRUMB_CUSTOM_TITLES;
  let breadcrumbs = usePathSegments(pathname);
  if (breadcrumbIndex && breadcrumbIndex > 0) {
    breadcrumbs = breadcrumbs.slice(breadcrumbIndex - 1);
  }

  breadcrumbs = breadcrumbs.filter(
    (breadcrumb) => getBreadcrumbTitle(breadcrumb.href, breadcrumb.label, titles) !== null,
  );

  return (
    <Breadcrumb className={cn("hidden md:flex", className)}>
      <BreadcrumbList className={cn("flex text-base sm:text-lg", listClassName)}>
        {breadcrumbs.map((breadcrumb, index) => {
          const title =
            getBreadcrumbTitle(breadcrumb.href, breadcrumb.label, titles) ?? breadcrumb.label;
          const linkHref = getBreadcrumbLinkHref(breadcrumb.href);

          return (
            <React.Fragment key={breadcrumb.href}>
              <BreadcrumbItem>
                {index === breadcrumbs.length - 1 || disabledHrefs.includes(breadcrumb.href) ? (
                  <BreadcrumbPage className="text-low-emphasis">{title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={linkHref} className="text-foreground hover:text-foreground">
                      {title}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
export default PageBreadcrumb;

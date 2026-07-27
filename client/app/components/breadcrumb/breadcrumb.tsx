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
import { usePathSegments } from "@seliseblocks/blocks-kit/hooks";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { cn } from "@/lib/utils";

const normalizeBreadcrumbHref = (href: string): string =>
  href.replace(/^\/app\/[^/]+(?=\/)/, "/app");

const getBreadcrumbTitle = (href: string, defaultLabel: string): string | null => {
  const normalizedHref = normalizeBreadcrumbHref(href);
  if (Object.prototype.hasOwnProperty.call(BREADCRUMB_CUSTOM_TITLES, normalizedHref)) {
    return BREADCRUMB_CUSTOM_TITLES[normalizedHref];
  }
  if (Object.prototype.hasOwnProperty.call(BREADCRUMB_CUSTOM_TITLES, href)) {
    return BREADCRUMB_CUSTOM_TITLES[href];
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
}> = ({ breadcrumbIndex, disabledHrefs = [], className, listClassName }) => {
  const { pathname } = useLocation();
  let breadcrumbs = usePathSegments(pathname);
  if (breadcrumbIndex && breadcrumbIndex > 0) {
    breadcrumbs = breadcrumbs.slice(breadcrumbIndex - 1);
  }

  breadcrumbs = breadcrumbs.filter(
    (breadcrumb) => getBreadcrumbTitle(breadcrumb.href, breadcrumb.label) !== null,
  );

  return (
    <Breadcrumb className={cn("hidden md:flex", className)}>
      <BreadcrumbList className={cn("flex text-base sm:text-lg", listClassName)}>
        {breadcrumbs.map((breadcrumb, index) => {
          const title = getBreadcrumbTitle(breadcrumb.href, breadcrumb.label) ?? breadcrumb.label;
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

import React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui-kits/breadcrumb/breadcrumb";
import { Link } from "react-router-dom";
import useRoutePathSegments from "@/hooks/use-path-segments";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { cn } from "@/lib/utils";

const getBreadcrumbTitle = (href: string, defaultLabel: string): string | null => {
  if (Object.prototype.hasOwnProperty.call(BREADCRUMB_CUSTOM_TITLES, href)) {
    return BREADCRUMB_CUSTOM_TITLES[href]
  }
  return defaultLabel
}

const PageBreadcrumb: React.FC<{
  breadcrumbIndex?: number;
  disabledHrefs?: string[];
  className?: string;
  listClassName?: string;
}> = ({ breadcrumbIndex, disabledHrefs = [], className, listClassName }) => {
  let breadcrumbs = useRoutePathSegments();
  if (breadcrumbIndex && breadcrumbIndex > 0) {
    breadcrumbs = breadcrumbs.slice(breadcrumbIndex - 1);
  }

  breadcrumbs = breadcrumbs.filter(
    (breadcrumb) => getBreadcrumbTitle(breadcrumb.href, breadcrumb.label) !== null,
  )

  return (
    <Breadcrumb className={cn("hidden md:flex", className)}>
      <BreadcrumbList className={listClassName}>
        {breadcrumbs.map((breadcrumb, index) => {
          const title = getBreadcrumbTitle(breadcrumb.href, breadcrumb.label) ?? breadcrumb.label

          return (
          <React.Fragment key={breadcrumb.href}>
            <BreadcrumbItem>
              {index === breadcrumbs.length - 1 || disabledHrefs.includes(breadcrumb.href) ? (
                <BreadcrumbPage className="text-low-emphasis">
                  {title}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={breadcrumb.href} className="text-foreground hover:text-foreground">
                    {title}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
export default PageBreadcrumb;

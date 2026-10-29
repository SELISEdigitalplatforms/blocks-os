import type { ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui-kits/breadcrumb/breadcrumb";
import { PageHeader } from "@/components/page-header/page-header";
import { NOTIFICATION_TEXT } from "../constants/notification-ui.constant";

interface NotificationPageHeaderProps {
  title: string;
  description: string;
  titleSuffix?: ReactNode;
  /** Back to the notification list; the pages live on query params, so the route breadcrumb can't do it. */
  onBack: () => void;
}

/** Breadcrumb and title of the notification form and the push page, styled like the list header. */
export function NotificationPageHeader({
  title,
  description,
  titleSuffix,
  onBack,
}: Readonly<NotificationPageHeaderProps>) {
  return (
    <div className="flex flex-col gap-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button type="button" onClick={onBack}>
                {NOTIFICATION_TEXT.breadcrumb}
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader title={title} description={description} titleSuffix={titleSuffix} />
    </div>
  );
}

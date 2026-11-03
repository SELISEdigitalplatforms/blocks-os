import React from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { useT } from "@seliseblocks/genesis-os";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui-kits/breadcrumb/breadcrumb";
interface EmailUsageDetailsBreadcrumbProps {
  id: string;
  isInbound?: boolean;
}
export const EmailUsageDetailsBreadcrumb = ({
  id,
  isInbound,
}: EmailUsageDetailsBreadcrumbProps) => {
  const { t } = useT("os.communication.mail");
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const backLink = scoped(
    isInbound ? "email-management?emailTab=Inbox" : "email-management?emailTab=Outgoingmails",
  );
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button onClick={() => navigate(backLink)}>{t("common:EMAIL")}</button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{id}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};

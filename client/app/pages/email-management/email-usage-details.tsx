import { EmailUsageDetails } from "@/cross-modules/communication/mail/email/email-usage/email-usage-details";
import { useParams } from "react-router";

export function EmailUsageDetailsPage() {
  const { id } = useParams<{ id: string }>();

  return <EmailUsageDetails id={id || ""} />;
}

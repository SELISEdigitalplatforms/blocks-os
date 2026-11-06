import { Badge } from "@/components/ui-kits/badge/badge";
import { MailStatus } from "@blocks-communication/mail/models/email";
import { useMailStatusLabel } from "@blocks-communication/mail/email/email-usage/use-mail-status-label";
interface StatusBadgeProps {
  status: string;
}
export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const statusLabel = useMailStatusLabel();
  let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "error" | "info" =
    "outline";
  switch (status) {
    case MailStatus.Delivered:
      variant = "success";
      break;
    case MailStatus.Bounced:
    case MailStatus.Complained:
    case MailStatus.Rejected:
      variant = "error";
      break;
    case MailStatus.Received:
      variant = "secondary";
      break;
    default:
      variant = "info";
  }
  return (
    <Badge variant={variant} className="w-24 whitespace-nowrap rounded-full">
      {statusLabel(status)}
    </Badge>
  );
};

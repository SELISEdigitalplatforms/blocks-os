import { useT } from "@seliseblocks/genesis-os";
import { MailStatus } from "@blocks-communication/mail/models/email";

/** Returns a function that turns a mail status value into its translated label. */
export const useMailStatusLabel = () => {
  const { t } = useT("os.communication.mail");
  return (status: string): string => {
    switch (status) {
      case MailStatus.Sent:
        return t("MAIL_STATUS.SENT");
      case MailStatus.Delivered:
        return t("MAIL_STATUS.DELIVERED");
      case MailStatus.Bounced:
        return t("MAIL_STATUS.BOUNCED");
      case MailStatus.Complained:
        return t("MAIL_STATUS.COMPLAINED");
      case MailStatus.Rejected:
        return t("MAIL_STATUS.REJECTED");
      case MailStatus.Received:
        return t("MAIL_STATUS.RECEIVED");
      default:
        return status;
    }
  };
};

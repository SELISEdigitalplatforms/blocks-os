import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useT } from "@seliseblocks/genesis-os";
import type { IEmailTemplate } from "@blocks-communication/mail/models/email";
import { useSendTestMail } from "@blocks-communication/mail/hooks/use-email-template";

interface SendTestEmailDialogProps {
  template: IEmailTemplate;
  /** The signed-in user's address; the test mail goes there. */
  to: string;
  languageName: string;
  organizationName: string;
  showOrganization: boolean;
  /** The configuration the mail goes out through, as the details page resolves it. */
  sendsThrough: string;
  onClose: () => void;
}

/** SPEC31 §4 TestMail design: a test mail of exactly this template, sent by its id (H12). */
export function SendTestEmailDialog({
  template,
  to,
  languageName,
  organizationName,
  showOrganization,
  sendsThrough,
  onClose,
}: SendTestEmailDialogProps) {
  const { t } = useT("os.communication.mail");
  const { mutateAsync: sendTestMail, isPending } = useSendTestMail();

  const onSend = async () => {
    try {
      const res = await sendTestMail({
        to,
        purpose: template.name ?? "",
        language: template.language ?? "",
        templateId: template.itemId,
      });
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("EMAIL_COMMUNICATION_DETAILS.TEST_SENT"),
        });
        onClose();
        return;
      }
      showErrorToast({ errors: res?.errors });
    } catch (error) {
      showErrorToast({ errors: isErrorWithErrors(error) ? error.errors : undefined });
    }
  };

  const rows: Array<[string, string]> = [
    [
      t("EMAIL_COMMUNICATION_DETAILS.TEMPLATE"),
      t("EMAIL_COMMUNICATION_DETAILS.TEMPLATE_SUMMARY", {
        name: template.name ?? "",
        language: languageName,
      }),
    ],
    ...(showOrganization
      ? ([[t("EMAIL_COMMUNICATION_DETAILS.ORGANIZATION"), organizationName]] as Array<
          [string, string]
        >)
      : []),
    [t("EMAIL_COMMUNICATION_DETAILS.SENDS_THROUGH"), sendsThrough],
  ];

  return (
    <DialogContent className="rounded-md sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle className="text-left">
          {t("EMAIL_COMMUNICATION_DETAILS.SEND_TEST_TITLE")}
        </DialogTitle>
        <DialogDescription className="text-left">
          {t("EMAIL_COMMUNICATION_DETAILS.SEND_TEST_CONFIRM")}
        </DialogDescription>
      </DialogHeader>
      <dl className="grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1">
            <dt className="text-sm text-low-emphasis">{label}</dt>
            <dd className="text-sm font-medium text-high-emphasis">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-low-emphasis">
        {t("EMAIL_COMMUNICATION_DETAILS.SEND_TEST_EXACT")}
      </p>
      <DialogFooter className="flex flex-row gap-2">
        <Button variant="outline" onClick={onClose}>
          {t("common:CANCEL")}
        </Button>
        <Button onClick={onSend} disabled={isPending}>
          {t("EMAIL_COMMUNICATION_DETAILS.SEND")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

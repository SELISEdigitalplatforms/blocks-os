import { EditEmailTemplate } from "@/cross-modules/communication/mail/email/email-template-edit/email-template-edit";
import { useParams } from "react-router";

export function EmailTemplateEditPage() {
  const { id } = useParams<{ id: string }>();

  return <EditEmailTemplate params={{ id: id || "" }} />;
}

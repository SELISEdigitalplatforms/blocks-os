import { EmailCommunicationDetails } from "@/cross-modules/communication/mail";
import { useParams } from "react-router";

export function EmailCommunicationDetailsPage() {
  const { id } = useParams<{ id: string }>();

  return <EmailCommunicationDetails params={{ id: id || "" }} />;
}

import { useParams } from "react-router";
import { OrganizationDetail } from "@blocks-idp/iam/pages/organization-detail";
export default function IamOrgDetailPage() {
  const { orgId } = useParams<{ orgId: string }>();
  return <OrganizationDetail id={orgId!} />;
}

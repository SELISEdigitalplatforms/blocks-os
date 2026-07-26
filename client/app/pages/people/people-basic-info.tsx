import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { checkValidDate, formatFullDate } from "@/lib/utils";
import { User } from "@blocks-idp/iam/models/user";

interface ItemProps {
  label: string;
  children?: React.ReactNode;
  isLoading?: boolean;
}

const Item = ({ label, children, isLoading = false }: ItemProps) => (
  <div className="space-y-1.5">
    <p className="text-sm text-muted-foreground">{label}</p>
    {isLoading ? (
      <Skeleton className="h-6 w-32" />
    ) : (
      <div className="text-base font-medium">{children}</div>
    )}
  </div>
);

export const PeopleBasicInfo = ({
  className,
  user: initialUser,
}: {
  className?: string;
  user?: User;
}) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Item label="Name">
            {initialUser?.firstName} {initialUser?.lastName}
          </Item>
          <Item label="Email">
            <div className="flex items-center gap-2">
              {initialUser?.email ? (
                <CopyToClipboardButton textToCopy={initialUser.email}>
                  <span>{initialUser.email}</span>
                </CopyToClipboardButton>
              ) : (
                "-"
              )}
            </div>
          </Item>
          <Item label="Role">
            {initialUser?.roles ? Object.values(initialUser.roles).flat().join(", ") || "-" : "-"}
          </Item>
          <Item label="Latest Login">
            {initialUser?.lastLoggedInTime && checkValidDate(initialUser.lastLoggedInTime)
              ? formatFullDate(new Date(initialUser.lastLoggedInTime))
              : "-"}
          </Item>
          <Item label="Browser">-</Item>
          <Item label="Signed up">
            {initialUser?.createdDate && checkValidDate(initialUser.createdDate)
              ? formatFullDate(new Date(initialUser.createdDate))
              : "-"}
          </Item>
        </div>
      </CardContent>
    </Card>
  );
};

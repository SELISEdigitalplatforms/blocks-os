import { PeopleBasicInfo } from "./people-basic-info";
import { User } from "@blocks-idp/iam/models/user";
import { UserIcon } from "lucide-react";

export const PeopleDetailsTab = ({ user }: { user?: User }) => {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="col-span-full lg:col-span-2">
        <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-full bg-gray-50 dark:bg-gray-800">
          {user?.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt="Profile"
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <UserIcon className="h-16 w-16" />
            </div>
          )}
        </div>
      </div>
      <div className="lg:col-span-10">
        <PeopleBasicInfo user={user} />
      </div>
    </div>
  );
};

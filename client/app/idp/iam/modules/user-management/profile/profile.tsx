import { useGetUser } from "@blocks-idp/iam/hooks/use-user";
import { ProfileDetails } from "@blocks-idp/iam/components/profile-details";
import { UpdateUser } from "../update-user";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { getRuntimeEnv } from "@/lib/runtime-env";

const x_blocks_key = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "";

const ProfileLoading = () => (
  <main className="flex flex-col gap-6 p-6">
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-9 w-24" />
    </div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <Skeleton className="h-40 w-full lg:col-span-3" />
      <div className="flex flex-col gap-4 lg:col-span-9">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  </main>
);

export const Profile = () => {
  const { isPending, isLoading, data } = useGetUser();

  if (isPending || isLoading) return <ProfileLoading />;

  const id = data?.data?.itemId || "";

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-semibold md:text-xl">
            {data?.data?.firstName} {data?.data?.lastName}
          </h4>
          <p className="mt-0.5 text-sm text-muted-foreground">{data?.data?.email}</p>
        </div>
        <UpdateUser id={id} projectKey={x_blocks_key} own />
      </div>
      <ProfileDetails id={id} />
    </main>
  );
};

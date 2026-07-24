import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { UseGetPeopleReturnType } from "@/hooks/use-people";
import { PeopleFilterToolbar } from "./people-filter-toolbar";
import { PeopleTable } from "./people-table";

type PeopleListProps = {
  data: UseGetPeopleReturnType | undefined;
  isPeopleLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};
export const PeopleList = ({
  data,
  isPeopleLoading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PeopleListProps) => {
  const isViewerOwner = data?.isOwner ?? false;
  const peoples = data?.peoples || [];
  const totalCount = data?.totalCount || 0;

  return (
    <Card>
      <CardHeader>
        <PeopleFilterToolbar />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="bg-card text-card-foreground">
          <PeopleTable people={peoples} isLoading={isPeopleLoading} isViewerOwner={isViewerOwner} />
        </div>

        {!isPeopleLoading && peoples.length > 0 && (
          <div className="flex justify-end">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              pageSizeOptions={[10, 20, 50, 100]}
              onChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

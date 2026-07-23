import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { PageHeader } from "@/components/page-header/page-header";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { ScrollArea, ScrollBar } from "@/components/ui-kits/scroll-area/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui-kits/tabs/tabs";
import {
  EMAIL_TABS,
  type EmailTabKey,
} from "@blocks-communication/mail/constants/email-tabs";
import { EmailTemplateList } from "@blocks-communication/mail/email/email-service-table/email-template-list";
import { EmailUsageList } from "@blocks-communication/mail/email/email-usage/email-usage-list";
import { useGetEmailConfigs } from "@blocks-communication/mail/hooks/use-email-config";
import { useGetEmailTemplates } from "@blocks-communication/mail/hooks/use-email-template";
import { useGetLanguages } from "@blocks-localization/hooks/use-language-manager";
import { CirclePlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useScopedPath } from "@seliseblocks/blocks-kit/hooks";
import { useEmailUsageFilterQueryParams } from "../email-usage/email-usage-filter-toolbar";
import { useQueryState } from "nuqs";
import {
  TemplateFilterToolbar,
  useTemplatesFilterQueryParams,
  useTemplatesSortQueryParams,
} from "./template-filter-toolbar";

const EMAIL_MANAGEMENT_TABS: { value: EmailTabKey; label: string }[] = [
  { value: "Emailstemplates", label: EMAIL_TABS.Emailstemplates.label },
  { value: "Inbox", label: EMAIL_TABS.Inbox.label },
  { value: "Outgoingmails", label: EMAIL_TABS.Outgoingmails.label },
];

const EMAIL_MANAGEMENT_TAB_META: Record<
  EmailTabKey,
  { title: string; description: string }
> = {
  Emailstemplates: {
    title: "Email Templates",
    description:
      "Create, review, and manage reusable email templates for application communication.",
  },
  Inbox: {
    title: "Incoming Mails",
    description:
      "Review received email activity, delivery details, and message history.",
  },
  Outgoingmails: {
    title: "Outgoing Mails",
    description:
      "Monitor sent email activity, delivery status, and failure details.",
  },
};

const DEFAULT_EMAIL_TAB: EmailTabKey = "Emailstemplates";

const isEmailTabKey = (value: string | null): value is EmailTabKey =>
  EMAIL_MANAGEMENT_TABS.some((tab) => tab.value === value);

const LoadingSkelton = () => {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded" />
      ))}
    </div>
  );
};
interface EmailServiceTableProps {
  onRowClick?: (id: string | number) => void;
}
export function EmailServiceTable({ onRowClick }: EmailServiceTableProps = {}) {
  const { queryParams, setQueryParams } = useTemplatesFilterQueryParams();
  const { sortQueryParams } = useTemplatesSortQueryParams();
  const { isLoading, data } = useGetEmailTemplates(
    queryParams.pageNumber ?? 0,
    queryParams.pageSize ?? 10,
    queryParams.search ?? "",
    sortQueryParams.property ?? "Name",
    sortQueryParams.isDescending ?? false,
    queryParams.language ?? "",
    queryParams.mailConfigurationId ?? "",
  );
  const { isLoading: isConfigsLoading, data: emailConfigsData } =
    useGetEmailConfigs(0, 100);
  const { isLoading: isLanguageListLoading, data: languageListData } =
    useGetLanguages();
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { setQueryParams: setEmailUsageQueryParams } =
    useEmailUsageFilterQueryParams();
  const [emailTab, setEmailTab] = useQueryState("emailTab", {
    defaultValue: DEFAULT_EMAIL_TAB,
  });
  const activeTab: EmailTabKey = isEmailTabKey(emailTab)
    ? emailTab
    : DEFAULT_EMAIL_TAB;
  const activeTabMeta = EMAIL_MANAGEMENT_TAB_META[activeTab];

  const handleTabChange = (value: string) => {
    void setEmailTab(value);
    setQueryParams(null);
    setEmailUsageQueryParams(null);
  };

  const onPageChangeHandler = (pageNumber: number) => {
    setQueryParams((prev) => ({
      ...prev,
      pageNumber,
    }));
  };
  const handleRowClick = (emailId: number | string) => {
    if (onRowClick) {
      onRowClick(emailId);
    } else {
      navigate(scoped(`email-management/communications/${emailId}`));
    }
  };
  const tableData = useMemo(() => {
    if (!data?.templates) return [];
    return data.templates;
  }, [data]);
  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="flex w-full flex-col"
        >
          <PageHeader
            title={activeTabMeta.title}
            description={activeTabMeta.description}
          />

          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-3">
            <div className="flex min-w-0 items-center gap-4">
              <div className="md:hidden">
                <Select
                  value={activeTab}
                  onValueChange={(value) =>
                    handleTabChange(value as EmailTabKey)
                  }
                >
                  <SelectTrigger
                    className="w-56"
                    aria-label="Email management section"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_MANAGEMENT_TABS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="hidden items-center md:flex">
                <TabsList className="h-[42px] bg-blocks-primary-shades-300">
                  {EMAIL_MANAGEMENT_TABS.map(({ value, label }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="h-8 px-4 text-sm"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </div>

            {activeTab === "Emailstemplates" ? (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="default"
                  variant="default"
                  className="bg-primary text-primary-foreground shadow-none"
                  onClick={() =>
                    navigate(scoped("email-management/new-communication"))
                  }
                >
                  <CirclePlus className="h-5 w-5 lg:mr-2" />
                  <span className="sr-only lg:not-sr-only">Add Template</span>
                </Button>
              </div>
            ) : null}
          </div>
          <TabsContent value="Emailstemplates">
            <Card className="rounded shadow-none">
              <CardContent className="mb-4">
                {isConfigsLoading || isLanguageListLoading ? (
                  <Skeleton className="h-12 w-full rounded" />
                ) : (
                  <TemplateFilterToolbar
                    emailConfigsData={
                      Array.isArray(emailConfigsData) ? emailConfigsData : []
                    }
                    languageListData={
                      Array.isArray(languageListData) ? languageListData : []
                    }
                  />
                )}
              </CardContent>
              <CardContent>
                <ScrollArea className="w-full">
                  {isLoading || isConfigsLoading ? (
                    <LoadingSkelton />
                  ) : (
                    <EmailTemplateList
                      templates={tableData}
                      isLoading={isLoading}
                      emailConfigsData={
                        Array.isArray(emailConfigsData) ? emailConfigsData : []
                      }
                      onRowClick={handleRowClick}
                    />
                  )}
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardContent>
              {!isLoading && data && data.totalCount > queryParams.pageSize && (
                <div className="mt-5 flex items-center md:justify-end">
                  <Pagination
                    page={queryParams.pageNumber}
                    pageSize={queryParams.pageSize}
                    totalCount={data?.totalCount || 0}
                    pageSizeOptions={[10]}
                    onChange={onPageChangeHandler}
                  />
                </div>
              )}
            </Card>
          </TabsContent>
          <TabsContent value="Inbox">
            <Card className="rounded shadow-none">
              <CardContent>
                <EmailUsageList isInbound />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="Outgoingmails">
            <Card className="rounded shadow-none">
              <CardContent>
                <EmailUsageList isInbound={false} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

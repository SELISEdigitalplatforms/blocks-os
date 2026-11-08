import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { useT } from "@seliseblocks/genesis-os";
// Sample layouts; each name is an English key in os.communication.mail.
const SAMPLE_IMAGE_SINGLE = "/assets/images/services/email/email-template-sample-1.png";
const SAMPLE_IMAGE_COLUMNS = "/assets/images/services/email/email-template-sample-2.png";
const templateData: Array<{
  id: string;
  nameKey: string;
  nameParams?: Record<string, number>;
  thumbnailUrl: string;
}> = [
  { id: "1", nameKey: "EMAIL_TEMPLATES.SAMPLE_SIMPLE_TEXT", thumbnailUrl: SAMPLE_IMAGE_SINGLE },
  {
    id: "2",
    nameKey: "EMAIL_TEMPLATES.SAMPLE_COLUMNS_1_2_1_2",
    thumbnailUrl: SAMPLE_IMAGE_COLUMNS,
  },
  { id: "3", nameKey: "EMAIL_TEMPLATES.SAMPLE_COLUMNS_1_2", thumbnailUrl: SAMPLE_IMAGE_COLUMNS },
  {
    id: "4",
    nameKey: "EMAIL_TEMPLATES.SAMPLE_COLUMNS_1_2_ALTERNATE",
    thumbnailUrl: SAMPLE_IMAGE_COLUMNS,
  },
  ...[2, 3, 4, 5, 6, 7].map((number, index) => ({
    id: String(index + 5),
    nameKey: "EMAIL_TEMPLATES.SAMPLE_COLUMNS_1_2_ALTERNATE_NUMBERED",
    nameParams: { number },
    thumbnailUrl: SAMPLE_IMAGE_COLUMNS,
  })),
];
const EmailTemplates = () => {
  const { t } = useT("os.communication.mail");
  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb breadcrumbIndex={2} />
      </div>
      <div className="mt-5">
        <h1 className="text-lg font-semibold md:text-2xl">{t("EMAIL_TEMPLATES.TITLE")}</h1>
      </div>
      <Tabs defaultValue="designed" className="mt-6">
        <div className="mb-5 flex items-center text-base">
          <TabsList className="h-[42px] bg-blocks-primary-shades-300">
            <TabsTrigger value="designed" className="h-8">
              {t("EMAIL_TEMPLATES.TAB_PRE_DESIGNED")}
            </TabsTrigger>
            <TabsTrigger value="myTemplates" className="h-8">
              {t("EMAIL_TEMPLATES.TAB_MY_TEMPLATES")}
            </TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="h-10 bg-primary text-sm text-primary-foreground"
            >
              <Plus className="h-5 w-5 md:mr-2" />
              <span className="sr-only sm:not-sr-only">{t("EMAIL_TEMPLATES.ADD_TEMPLATE")}</span>
            </Button>
          </div>
        </div>
        <TabsContent value="designed">
          <div className="rounded-sm border bg-background p-4">
            <h1 className="text-xl font-semibold">{t("EMAIL_TEMPLATES.SECTION_TEMPLATES")}</h1>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {templateData.map((item) => (
                <div key={item.id} className="flex h-full flex-col justify-center gap-2">
                  <div className="relative flex h-[360px] flex-col items-center justify-center rounded-sm border">
                    <img
                      src={item.thumbnailUrl}
                      alt={t("EMAIL_TEMPLATES.IMAGE_ALT")}
                      width={240}
                      height={360}
                    />
                  </div>
                  <p className="mt-3 text-base">{t(item.nameKey, item.nameParams)}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="myTemplates">
          <div className="rounded-sm border bg-background p-4">
            <h1 className="text-xl font-semibold">{t("EMAIL_TEMPLATES.SECTION_TEMPLATES")}</h1>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {templateData.map((item) => (
                <div key={item.id} className="flex h-full flex-col justify-center gap-2">
                  <div className="relative flex h-[360px] flex-col items-center justify-center rounded-sm border">
                    <img
                      src={item.thumbnailUrl}
                      alt={t("EMAIL_TEMPLATES.IMAGE_ALT")}
                      width={240}
                      height={360}
                    />
                  </div>
                  <p className="mt-3 text-base">{t(item.nameKey, item.nameParams)}</p>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default EmailTemplates;

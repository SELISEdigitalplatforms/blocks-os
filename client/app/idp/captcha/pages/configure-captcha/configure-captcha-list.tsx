import { Button } from "@/components/ui-kits/button/button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { CAPTCHA_PROVIDERS, ICaptchaConfig } from "../../models/captcha";
import { ConfigureCaptchaModal } from "../../modals/configure-captcha-modal";
import { DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { MaskedText } from "@/components/masked-text";
import { ReactNode } from "react";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { ToggleCaptchaStatusModal } from "@blocks-idp/captcha/modals/toggle-captcha-status-modal";
const LoadingSkelton = () => (
  <div className="grid gap-4">
    {Array.from({ length: 2 }).map((_, index) => (
      <Card key={index}>
        <CardHeader className="flex-row justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="hidden gap-4 sm:flex">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-5 w-48" />
            </div>
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-48" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);
const EmptyCaptchaConfig = () => {
  return (
    <div className="text-muted- flex h-32 flex-wrap items-center justify-center rounded-sm border bg-background p-4 text-center text-muted-foreground">
      No configurations found. Please create a new configuration.
    </div>
  );
};
const Item = ({ label, children }: { label: string; children: ReactNode }) => {
  return (
    <div>
      <p className="text-sm font-medium text-low-emphasis">{label}</p>
      <div className="text-wrap text-base font-normal text-high-emphasis">{children}</div>
    </div>
  );
};
type ConfigureCaptchaListProps = {
  isLoading: boolean;
  configurations: ICaptchaConfig[];
};
export const ConfigureCaptchaList = ({ isLoading, configurations }: ConfigureCaptchaListProps) => {
  if (isLoading) return <LoadingSkelton />;
  if (!configurations.length) return <EmptyCaptchaConfig />;
  return (
    <>
      <div className="grid gap-4">
        {configurations.map((configuration) =>
          CAPTCHA_PROVIDERS[configuration.provider] ? (
            <Card key={configuration.itemId}>
              <CardHeader className="flex-row justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle> {CAPTCHA_PROVIDERS[configuration.provider].label} </CardTitle>
                  {configuration.isEnable && <Badge variant="success">Enable</Badge>}
                </div>
                <div className="hidden gap-4 sm:flex">
                  <ConfigureCaptchaModal configuration={configuration}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Pencil className="h-4 w-4" />
                        <span className="ml-2.5">Edit</span>
                      </Button>
                    </DialogTrigger>
                  </ConfigureCaptchaModal>
                  <ToggleCaptchaStatusModal configuration={configuration} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4 sm:hidden">
                    <ConfigureCaptchaModal configuration={configuration}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Pencil className="h-4 w-4" />
                          <span className="ml-2.5">Edit</span>
                        </Button>
                      </DialogTrigger>
                    </ConfigureCaptchaModal>
                    <ToggleCaptchaStatusModal configuration={configuration} />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Item label="Site Key">
                      <CopyToClipboardButton textToCopy={configuration.captchaKey}>
                        <MaskedText text={configuration.captchaKey} length={30} />
                      </CopyToClipboardButton>
                    </Item>
                    <Item label="Secret Key">
                      <CopyToClipboardButton textToCopy={configuration.captchaSecret}>
                        <MaskedText text={configuration.captchaSecret} length={30} />
                      </CopyToClipboardButton>
                    </Item>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null
        )}
      </div>
    </>
  );
};

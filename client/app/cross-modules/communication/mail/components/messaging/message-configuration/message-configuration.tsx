import React from "react";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useT } from "@seliseblocks/genesis-os";
interface MessageConfigurationProps {
  dialogTitle: string;
  data?: string[];
}
const MessageConfiguration: React.FC<MessageConfigurationProps> = ({ dialogTitle }) => {
  const { t } = useT("os.communication.mail");
  return (
    <DialogContent className="rounded-md sm:max-w-[700px]">
      <DialogHeader>
        <DialogTitle className="mb-2 text-left">{dialogTitle}</DialogTitle>
        <hr />
        <DialogDescription asChild>
          <div className="py-4 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="protocol" className="text-left font-medium text-high-emphasis">
                  {t("MESSAGE_CONFIGURATION.PROTOCOL")}
                </Label>
                <Input
                  id="protocol"
                  placeholder={t("MESSAGE_CONFIGURATION.PLACEHOLDER_HOST")}
                  className="border-default col-span-3 mt-1 border shadow-none"
                />
              </div>
              <div>
                <Label htmlFor="serviceVendor" className="text-left font-medium text-high-emphasis">
                  {t("MESSAGE_CONFIGURATION.SERVICE_VENDOR")}
                </Label>
                <Input
                  id="serviceVendor"
                  placeholder={t("MESSAGE_CONFIGURATION.PLACEHOLDER_PORT")}
                  className="border-default col-span-3 mt-1 border shadow-none"
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="configName" className="text-left font-medium text-high-emphasis">
                  {t("MESSAGE_CONFIGURATION.CONFIGURATION_NAME")}
                </Label>
                <Input
                  id="configName"
                  placeholder={t("MESSAGE_CONFIGURATION.PLACEHOLDER_CONFIGURATION_NAME")}
                  className="border-default col-span-3 mt-1 border shadow-none"
                />
              </div>
              <div>
                <Label htmlFor="id" className="text-left font-medium text-high-emphasis">
                  {t("MESSAGE_CONFIGURATION.CONFIGURATION_ID")}
                </Label>
                <Input
                  id="id"
                  placeholder={t("MESSAGE_CONFIGURATION.PLACEHOLDER_CONFIGURATION_ID")}
                  className="border-default col-span-3 mt-1 border shadow-none"
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <Label
                  htmlFor="authenticationToken"
                  className="text-left font-medium text-high-emphasis"
                >
                  {t("MESSAGE_CONFIGURATION.AUTHENTICATION_TOKEN")}
                </Label>
                <Input
                  id="authenticationToken"
                  placeholder={t("MESSAGE_CONFIGURATION.PLACEHOLDER_USERNAME")}
                  className="border-default col-span-3 mt-1 border shadow-none"
                />
              </div>
              <div>
                <Label htmlFor="AccountID" className="text-left font-medium text-high-emphasis">
                  {t("MESSAGE_CONFIGURATION.ACCOUNT_ID")}
                </Label>
                <Input
                  id="AccountID"
                  placeholder={t("MESSAGE_CONFIGURATION.PLACEHOLDER_PASSWORD")}
                  className="border-default col-span-3 mt-1 border shadow-none"
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username" className="text-left font-medium text-high-emphasis">
                  {t("MESSAGE_CONFIGURATION.SENDER")}
                </Label>
                <Input
                  id="username"
                  placeholder={t("MESSAGE_CONFIGURATION.PLACEHOLDER_USERNAME")}
                  className="border-default col-span-3 mt-1 border shadow-none"
                />
              </div>
              <div>
                <Label
                  htmlFor="numberLookupEndURI"
                  className="text-left font-medium text-high-emphasis"
                >
                  {t("MESSAGE_CONFIGURATION.NUMBER_LOOKUP_END_URI")}
                </Label>
                <Input
                  id="numberLookupEndURI"
                  placeholder={t("MESSAGE_CONFIGURATION.PLACEHOLDER_PASSWORD")}
                  className="border-default col-span-3 mt-1 border shadow-none"
                />
              </div>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex flex-row gap-2">
        <DialogTrigger asChild>
          <Button variant="outline" size="default">
            {t("common:CANCEL")}
          </Button>
        </DialogTrigger>
        <Button size="default">{t("common:SAVE")}</Button>
      </DialogFooter>
    </DialogContent>
  );
};
export default MessageConfiguration;

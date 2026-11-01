import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui-kits/input/input";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useT } from "@seliseblocks/genesis-os";
import { IEmailConfig } from "../../../../models/email";
import { useSaveEmailConfig } from "../../../../hooks/use-email-config";

interface EditDefaultSenderNameProps {
  config: IEmailConfig;
  onClose: () => void;
}

type TranslateFn = ReturnType<typeof useT>["t"];

const createSchema = (t: TranslateFn) =>
  z.object({
    senderName: z
      .string()
      .trim()
      .min(3, { message: t("EDIT_DEFAULT_SENDER_NAME.ERROR_SENDER_NAME_LENGTH") })
      .max(100, { message: t("EDIT_DEFAULT_SENDER_NAME.ERROR_SENDER_NAME_LENGTH") }),
  });

type FormValues = z.infer<ReturnType<typeof createSchema>>;

/**
 * The default configuration is platform-provisioned: its credentials never reach the browser,
 * so the full configuration form cannot save it. The sender name is the one field a project
 * may change, and the server ignores everything else on a default record.
 */
const EditDefaultSenderName: React.FC<EditDefaultSenderNameProps> = ({ config, onClose }) => {
  const { t } = useT("os.communication.mail");
  const schema = useMemo(() => createSchema(t), [t]);
  const { isPending, mutateAsync } = useSaveEmailConfig();
  const form = useForm<FormValues>({
    defaultValues: { senderName: config.senderName ?? "" },
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const formSubmitHandler = async ({ senderName }: FormValues) => {
    try {
      // The stored values ride along only so the request binds; the server keeps its own.
      const res = await mutateAsync({
        configurationId: config.itemId,
        configurationName: config.name,
        host: config.host,
        port: config.port,
        enableSSL: config.enableSSL,
        senderName,
        senderAddress: config.senderAddress,
        isInbound: config.isInbound,
        provider: config.provider,
        authenticationType: config.authenticationType,
        securityMode: config.securityMode,
      });
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("EDIT_DEFAULT_SENDER_NAME.UPDATED_SUCCESS"),
        });
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: JSON.stringify(res?.errors),
        });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors as Record<string, string | string[]> });
      }
    }
  };

  return (
    <DialogContent className="rounded-md sm:max-w-[450px]">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(formSubmitHandler)}>
          <DialogHeader>
            <DialogTitle className="mb-2 text-left">{t("EDIT_DEFAULT_SENDER_NAME.TITLE")}</DialogTitle>
            <DialogDescription className="text-left">
              {t("EDIT_DEFAULT_SENDER_NAME.DESCRIPTION")}
            </DialogDescription>
          </DialogHeader>
          <div className="pb-4 pt-4">
            <FormField
              name="senderName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left font-medium text-high-emphasis">
                    {t("EDIT_DEFAULT_SENDER_NAME.SENDER_NAME")} <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("EDIT_DEFAULT_SENDER_NAME.PLACEHOLDER_SENDER_NAME")}
                      className="border-default mt-1 border shadow-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="flex flex-row justify-end gap-2">
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="default" disabled={isPending}>
                {t("common:CANCEL")}
              </Button>
            </DialogTrigger>
            <Button
              type="submit"
              size="default"
              disabled={isPending || !form.formState.isValid || !form.formState.isDirty}
            >
              {isPending
                ? t("EDIT_DEFAULT_SENDER_NAME.UPDATING")
                : t("EDIT_DEFAULT_SENDER_NAME.UPDATE_CHANGES")}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
};

export default EditDefaultSenderName;

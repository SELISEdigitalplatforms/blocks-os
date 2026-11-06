import { ChipsInput, ChipsInputField, ChipsInputList } from "@/components/chip-input/chips-input";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogClose,
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
import { Input } from "@/components/ui-kits/input/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { useRegisterService } from "@blocks-identifier/hooks/use-services";
import { IRegisterServicePayload } from "@blocks-identifier/types/services.type";
import { addServiceDefaultValues, AddServiceForm, createAddServiceSchema } from "./utils";
import { useT } from "@seliseblocks/genesis-os";
export const AddService = () => {
  const { t } = useT("os.identifier");
  const [open, onOpenChange] = useState(false);
  const { mutateAsync: registerService, isPending } = useRegisterService();
  const form = useForm<AddServiceForm>({
    defaultValues: addServiceDefaultValues,
    resolver: zodResolver(createAddServiceSchema()) as Resolver<AddServiceForm>,
  });
  const {
    formState: { isDirty },
  } = form;
  const handleSubmit = async (formValues: AddServiceForm) => {
    try {
      const payload: IRegisterServicePayload = {
        ...formValues,
      };
      const response = await registerService(payload);
      if (!response.isSuccess)
        return showErrorToast({
          errors: response.errors || t("ADD_SERVICE.FAILED_TO_REGISTER_THE_SERVICE"),
        });
      showSuccessToast({ description: t("ADD_SERVICE.SERVICE_REGISTERED_SUCCESSFULLY") });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: t("ADD_SERVICE.SOMETHING_WENT_WRONG") });
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-2 sm:text-sm sm:whitespace-nowrap">
            {t("ADD_SERVICE.REGISTER_SERVICE")}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("ADD_SERVICE.REGISTER_NEW_SERVICE")}</DialogTitle>
          <DialogDescription>{t("ADD_SERVICE.REGISTER_A_NEW_SERVICE_TO")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="serviceName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("ADD_SERVICE.SERVICE_NAME", { span: "*" })}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("ADD_SERVICE.ENTER_NAME")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="serviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common:TYPE")}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="frontend">{t("ADD_SERVICE.FRONTEND")}</SelectItem>
                          <SelectItem value="backend">{t("ADD_SERVICE.BACKEND")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="tags"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("ADD_SERVICE.TAGS")}</FormLabel>
                    <FormControl>
                      <ChipsInput
                        {...field}
                        customValidator={(val) => !field.value?.includes(val)}
                        validatorRegexErrorMessage={t("ADD_SERVICE.DUPLICATE_TAGS_ARE_NOT_ALLOWED")}
                      >
                        <ChipsInputList />
                        <ChipsInputField />
                      </ChipsInput>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common:DESCRIPTION")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("ADD_SERVICE.BRIEF_DESCRIPTION_OF_THE_SERVICE")}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex flex-col justify-end gap-2 pt-4 md:flex-row">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("common:CANCEL")}
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending || !isDirty}>
                {t("common:SAVE")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

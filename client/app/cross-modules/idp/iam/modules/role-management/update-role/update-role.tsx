import { useT } from "@seliseblocks/genesis-os";
import { useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { showErrorToast, showSuccessToast, useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { createUpdateRoleFormSchema, UpdateRoleFormValues } from "./utils";
import { IRole } from "@blocks-idp/iam/models/role";
import { useUpdateRole } from "@blocks-idp/iam/hooks/use-roles";
import { isErrorWithErrors } from "@/lib/error";
import { ManagedBySelect } from "../managed-by-select";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
type UpdateRoleProps = { role: IRole; isOpen: boolean; onClose: () => void };
export const UpdateRole = ({ role, isOpen, onClose }: UpdateRoleProps) => {
  const { t } = useT("os.idp.roles");
  const { toast } = useToast();
  const { mutateAsync, isPending } = useUpdateRole();
  const form = useForm({
    defaultValues: role,
    resolver: zodResolver(createUpdateRoleFormSchema()),
  });
  const {
    formState: { isDirty },
  } = form;
  const onSubmit: SubmitHandler<UpdateRoleFormValues> = async (data) => {
    const { parentRoleSlug, ...rest } = data;
    const currentParent = role.parentRoleSlug ?? "";
    const newRole = {
      ...rest,
      itemId: role.itemId,
      // Sent only when "Managed by" changed; an empty choice clears it with an explicit null.
      ...((parentRoleSlug ?? "") === currentParent
        ? {}
        : { parentRoleSlug: parentRoleSlug || null }),
    };
    try {
      await mutateAsync(newRole);
      toast({
        variant: "success",
        title: t("common:SUCCESS"),
        description: t("UPDATE_ROLE.UPDATED_SUCCESS"),
      });
      showSuccessToast({ description: t("UPDATE_ROLE.UPDATED_SUCCESS") });
      onClose();
    } catch (error) {
      if (isErrorWithErrors(error)) {
        const { errors } = error;
        showErrorToast({ errors });
      }
    }
  };
  useEffect(() => {
    if (!isOpen) form.reset(role);
  }, [role, form, isOpen]);
  return (
    <DialogContent>
      <DialogHeader className="mb-4">
        <DialogTitle>{t("UPDATE_ROLE.TITLE")}</DialogTitle>
        <DialogDescription></DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common:NAME")}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t("UPDATE_ROLE.NAME_PLACEHOLDER")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="description"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common:DESCRIPTION")}</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder={t("UPDATE_ROLE.DESCRIPTION_PLACEHOLDER")} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="parentRoleSlug"
            control={form.control}
            render={({ field }) => (
              <ManagedBySelect
                value={field.value}
                onChange={(slug) => field.onChange(slug)}
                excludeSlug={role.slug}
                disabled={isPending}
              />
            )}
          />
          <DialogFooter className="mt-6">
            <DialogTrigger asChild>
              <Button className="min-w-[80px]" variant="outline" disabled={isPending}>
                {t("common:CANCEL")}
              </Button>
            </DialogTrigger>
            <Button className="min-w-[80px]" type="submit" disabled={isPending || !isDirty}>
              {isPending ? t("UPDATE_ROLE.UPDATING") : t("common:UPDATE")}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

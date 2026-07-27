import { DialogClose, DialogFooter } from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { Button } from "@/components/ui-kits/button/button";
import { useUpdateTenantGroup } from "@/hooks/use-project";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  editProjectFormDefaultValues,
  editProjectFormSchema,
  type EditProjectFormSchema,
} from "./edit-project-form.schema";
import {
  showErrorToast,
  showSuccessToast,
  isErrorWithErrors,
} from "@seliseblocks/genesis-os/utils";
import { useQueryClient } from "@tanstack/react-query";

interface EditProjectFormProps {
  tenantGroupId: string;
  currentName: string;
  onAfterSubmit: () => void;
}

export const EditProjectForm = ({
  tenantGroupId,
  currentName,
  onAfterSubmit,
}: EditProjectFormProps) => {
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useUpdateTenantGroup();

  const form = useForm<EditProjectFormSchema>({
    resolver: zodResolver(editProjectFormSchema),
    defaultValues: {
      ...editProjectFormDefaultValues,
      name: currentName,
    },
    mode: "onChange",
  });

  const onSubmit = async (values: EditProjectFormSchema) => {
    try {
      const res = await mutateAsync({
        name: values.name,
        tenantGroupId,
      });

      if (res.isSuccess) {
        showSuccessToast({
          title: "Project updated",
          description: "Project name updated successfully",
        });
        queryClient.invalidateQueries({ queryKey: ["identifier", "project"] });
        form.reset();
        onAfterSubmit();
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm font-medium text-medium-emphasis">
                Project Name
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter project name" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter className="mt-2 flex flex-row justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="w-20">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            className="w-20"
            type="submit"
            disabled={!form.formState.isValid || isPending || !form.formState.isDirty}
          >
            Save
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

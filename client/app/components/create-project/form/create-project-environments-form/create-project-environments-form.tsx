import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui-kits/form/form";
import {
  createProjectEnvironmentFormDefaultValue,
  createCreateProjectEnvironmentFormSchema,
  getEnvironmentOptions,
} from "./utils";
import { ProjectEnvironmentCheckboxes } from "../project-environment-checkboxes";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui-kits/button/button";
import { useCreateProjectFormState } from "../../utils";
import { useProjectForm } from "@/hooks/use-project";
import { useT } from "@seliseblocks/genesis-os";
export const CreateProjectEnvironmentsForm = () => {
  const { t } = useT("os.create-project");
  const { isPending, saveProject } = useProjectForm();
  const { formData, setFormData } = useCreateProjectFormState();
  const form = useForm({
    defaultValues: formData[2],
    resolver: zodResolver(createCreateProjectEnvironmentFormSchema()),
  });
  const onSubmitHandler = (values: typeof createProjectEnvironmentFormDefaultValue) => {
    const sortedEnvironments = [...values.environments].sort(
      (a: { value: string }, b: { value: string }) => {
        const aIndex = getEnvironmentOptions().find((opt) => opt.value === a.value)?.index ?? 0;
        const bIndex = getEnvironmentOptions().find((opt) => opt.value === b.value)?.index ?? 0;
        return aIndex - bIndex;
      },
    );
    setFormData(2, { ...values, environments: sortedEnvironments });
    saveProject();
  };
  const { isValid } = form.formState;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmitHandler)}>
        <div className="mt-4 flex flex-col gap-1 text-left">
          <p className="text-3xl font-bold tracking-tight">
            {t("CREATE_PROJECT_ENVIRONMENTS_FORM.SELECT_ENVIRONMENTS")}
          </p>
          <p className="text-base font-normal tracking-tight">
            {t("CREATE_PROJECT_ENVIRONMENTS_FORM.SELECT_THE_ENVIRONMENTS_YOU_WANT")}
          </p>
          <div className="">
            <div className="mt-8 text-sm">
              <FormField
                control={form.control}
                name="environments"
                render={({ field }) => (
                  <FormItem>
                    <ProjectEnvironmentCheckboxes
                      selected={(field.value || []).map((env: { value: string }) => env.value)}
                      onToggle={(environment, checked) => {
                        const currentValues = [...(field.value || [])];
                        if (checked) {
                          field.onChange([...currentValues, { value: environment }]);
                        } else {
                          field.onChange(
                            currentValues.filter(
                              (env: { value: string }) => env.value !== environment,
                            ),
                          );
                        }
                      }}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
        <div className="mb-4 mt-10">
          <Button size="lg" disabled={!isValid || isPending}>
            {t("common:SUBMIT")}
          </Button>
        </div>
      </form>
    </Form>
  );
};

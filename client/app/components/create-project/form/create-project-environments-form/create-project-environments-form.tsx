import { useForm } from "react-hook-form";
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui-kits/form/form";
import {
  createProjectEnvironmentFormDefaultValue,
  createProjectEnvironmentFormSchema,
  environmentOptions,
} from "./utils";
import { ProjectEnvironmentCheckboxes } from "../project-environment-checkboxes";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui-kits/button/button";
import { useCreateProjectFormState } from "../../utils";
import { useProjectForm } from "@/hooks/use-project";
import { useEnvironmentOptions } from "@blocks-identifier/hooks/use-catalogue";
export const CreateProjectEnvironmentsForm = () => {
  const { isPending, saveProject } = useProjectForm();
  const { formData, setFormData } = useCreateProjectFormState();
  // Environments come from the published catalogue. The static list is only a fallback for when
  // the catalogue cannot be reached — it is not the source of truth and must not drift into one.
  const { options: catalogueOptions, market, loading: catalogueLoading } = useEnvironmentOptions();
  const options = catalogueOptions.length
    ? catalogueOptions.map((option) => ({
        index: option.rank,
        label: option.label,
        value: option.value,
        subtext:
          environmentOptions.find((fallback) => fallback.value === option.value)?.subtext ?? "",
        price: option.price,
        freePrice: option.freeTierAvailable ? option.freePrice : null,
        meterCount: Object.keys(option.limits).length,
      }))
    : environmentOptions.map((option) => ({
        ...option,
        price: null as number | null,
        freePrice: null as number | null,
        meterCount: 0,
      }));

  const money = (amount: number | null) =>
    amount === null || market === null
      ? null
      : amount === 0
        ? "Free"
        : `${market} ${amount.toLocaleString()}`;
  const form = useForm({
    defaultValues: formData[2],
    resolver: zodResolver(createProjectEnvironmentFormSchema),
  });
  const onSubmitHandler = (values: typeof createProjectEnvironmentFormDefaultValue) => {
    const sortedEnvironments = [...values.environments].sort(
      (a: { value: string }, b: { value: string }) => {
        const aIndex = options.find((opt) => opt.value === a.value)?.index ?? 0;
        const bIndex = options.find((opt) => opt.value === b.value)?.index ?? 0;
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
          <p className="text-3xl font-bold tracking-tight">Select environments</p>
          <p className="text-base font-normal tracking-tight">
            Select the environments you want to enable for this project. You can configure each one
            individually later.
          </p>
          <div className="">
            <div className="mt-8 text-sm">
              <FormField
                control={form.control}
                name="environments"
                render={({ field }) => (
                  <FormItem>
                    <ProjectEnvironmentCheckboxes
                      options={options.map((option) => ({
                        label: option.label,
                        value: option.value,
                        subtext: option.subtext,
                        priceLabel: money(option.price)
                          ? `${money(option.price)}${option.freePrice !== null ? " · free tier available" : ""}`
                          : null,
                        meterCount: option.meterCount,
                      }))}
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
          <Button size="lg" disabled={!isValid || isPending || catalogueLoading}>
            Submit
          </Button>
        </div>
      </form>
    </Form>
  );
};

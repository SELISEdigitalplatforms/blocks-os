import { useForm } from "react-hook-form";
import { GitBranch } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import {
  createProjectEnvironmentFormDefaultValue,
  createProjectEnvironmentFormSchema,
  environmentOptions,
} from "./utils";
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
          <div className="mt-2 flex min-h-10 w-fit flex-row items-center gap-1 rounded border border-base-warning bg-warning-100 p-3 text-sm text-warning-800">
            <span>
              Please ensure that the branch name in your Git repository matches the
              environment&apos;s label exactly — for example, use &apos;dev&apos; for the
              Development environment.
            </span>
          </div>
          <div className="">
            <div className="mt-8 text-sm">
              <FormField
                control={form.control}
                name="environments"
                render={() => (
                  <FormItem>
                    {options.map((option) => (
                      <FormField
                        key={option.value}
                        control={form.control}
                        name="environments"
                        render={({ field }) => {
                          const isSelected = field.value?.some(
                            (env: { value: string }) => env.value === option.value,
                          );
                          return (
                            <FormItem className="mb-4 flex flex-col">
                              <div className="flex items-center gap-2">
                                <FormControl>
                                  <Checkbox
                                    className="h-5 w-5"
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      const currentValues = [...(field.value || [])];
                                      if (checked) {
                                        field.onChange([...currentValues, { value: option.value }]);
                                      } else {
                                        field.onChange(
                                          currentValues.filter(
                                            (env: { value: string }) => env.value !== option.value,
                                          ),
                                        );
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="!m-0 text-lg font-bold">
                                  <div className="flex flex-row items-center gap-2">
                                    <span>{option.label}</span>
                                    <div className="flex flex-row items-center">
                                      <GitBranch className="h-3 w-3 text-gray-400" />
                                      <span className="text-sm text-gray-400">
                                        {option.value === "prod" ? "main" : option.value}
                                      </span>
                                    </div>
                                    {money(option.price) && (
                                      <span className="text-sm font-medium text-gray-500">
                                        {money(option.price)}
                                        {option.freePrice !== null && " · free tier available"}
                                      </span>
                                    )}
                                  </div>
                                </FormLabel>
                              </div>
                              <div className="ml-7 text-base font-normal">{option.subtext}</div>
                              {option.meterCount > 0 && (
                                <div className="ml-7 text-sm text-gray-400">
                                  {option.meterCount} metered limits
                                </div>
                              )}
                            </FormItem>
                          );
                        }}
                      />
                    ))}
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

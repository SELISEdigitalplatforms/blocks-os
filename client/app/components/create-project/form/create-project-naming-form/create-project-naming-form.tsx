import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { createProjectNamingFormDefaultValue, createProjectNamingFormSchema } from "./utils";
import { ProjectTermsCheckboxes } from "../project-terms-checkboxes";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { useStepper } from "@/components/stepper/stepper-provider";
import { useCreateProjectFormState } from "../../utils";
import { WIZARD_EXIT, WizardFooter, WizardShell } from "../../wizard-shell";
import { projectSlug } from "../../wizard-model";

export const CreateProjectNamingForm = () => {
  const { naming, setNaming, resetFormData } = useCreateProjectFormState();
  const { nextStep } = useStepper();
  const form = useForm({
    values: naming,
    mode: "onChange",
    resolver: zodResolver(createProjectNamingFormSchema),
  });
  const onSubmitHandler = (values: typeof createProjectNamingFormDefaultValue) => {
    setNaming({ ...values, name: values.name.trim(), description: values.description.trim() });
    nextStep();
  };
  const { isValid } = form.formState;
  const name = form.watch("name");

  return (
    <WizardShell
      intro="Four steps. Nothing is created or charged until the last one."
      note={{
        title: "Every project starts free",
        body: "Every project includes one free development environment, for as long as you keep it.",
      }}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmitHandler)}
          className="flex flex-1 flex-col gap-6 px-4 pb-6 pt-6 md:px-10 md:pt-11"
        >
          <div>
            <h1 className="mb-1.5 text-[28px] font-bold tracking-tight text-high-emphasis">
              Name your project
            </h1>
            <p className="text-[13.5px] text-medium-emphasis">
              This is what your team will see. You can rename it later; the identifier stays put.
            </p>
          </div>

          <div className="flex max-w-[620px] flex-col gap-5">
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12.5px] font-semibold">Project name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="text"
                      autoComplete="off"
                      className="h-auto px-3 py-2.5 text-sm"
                      placeholder="Northwind Portal"
                    />
                  </FormControl>
                  <div className="flex items-center gap-2 text-[11.5px] text-low-emphasis">
                    <span>Identifier</span>
                    <span className="rounded bg-blocks-primary-50 px-1.5 py-0.5 font-mono text-blocks-primary-700">
                      {projectSlug(name ?? "")}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[12.5px] font-semibold">
                    Description <span className="font-normal text-low-emphasis">optional</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder="What this project is for."
                      className="text-[13.5px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isUseBlocksExclusively"
              render={({ field }) => (
                <FormItem>
                  <ProjectTermsCheckboxes
                    isAcceptBlocksTerms={form.watch("isAcceptBlocksTerms")}
                    isUseBlocksExclusively={field.value}
                    onAcceptBlocksTermsChange={(checked) =>
                      form.setValue("isAcceptBlocksTerms", checked, { shouldValidate: true })
                    }
                    onUseBlocksExclusivelyChange={(checked) =>
                      form.setValue("isUseBlocksExclusively", checked, { shouldValidate: true })
                    }
                  />
                </FormItem>
              )}
            />
          </div>

          <WizardFooter
            note={
              name?.trim()
                ? "Next: choose the environments this project needs."
                : "Give the project a name to continue."
            }
            back={{ label: "Cancel", to: WIZARD_EXIT, onClick: resetFormData }}
            primary={
              <Button type="submit" disabled={!isValid}>
                Continue
              </Button>
            }
          />
        </form>
      </Form>
    </WizardShell>
  );
};

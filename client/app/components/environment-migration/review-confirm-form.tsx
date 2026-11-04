import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui-kits/input-otp/input-otp";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { useCountDown } from "@seliseblocks/genesis-os/hooks";
import { useInitiateMigration, useVerifyMigration } from "@/hooks/use-project";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useProjectStore, useT, tStatic } from "@seliseblocks/genesis-os";
import { useDataMigrationFormState } from "./migration-form-state";
import {
  MIGRATION_SERVICE_NAME_TO_ID,
  createMigrationVerificationSchema,
} from "./migration-form-schema";

const I18N_MODULE = "os.environments";

const CustomInputOTPSlot = ({ index }: { index: number }) => (
  <InputOTPSlot
    index={index}
    className="h-12 w-[46px] rounded-sm border px-4 py-3.5 first:rounded-l-sm first:border-l last:rounded-r-sm"
  />
);

export const ReviewConfirmForm = () => {
  const { t } = useT(I18N_MODULE);
  const navigate = useNavigate();
  const { formData } = useDataMigrationFormState();
  const groupId = useProjectStore().selectedTenantGroup;
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const { remainingTime, reset } = useCountDown(300);

  const { mutateAsync: initiateMigration, isPending: isInitiating } = useInitiateMigration();
  const { mutateAsync: verifyMigration, isPending: isVerifying } = useVerifyMigration();

  const verificationForm = useForm({
    resolver: zodResolver(createMigrationVerificationSchema()),
    defaultValues: { verificationCode: "" },
  });

  const buildMigrationPayload = () => {
    const services = formData[0].services
      .filter((service) => service.selected)
      .map((service) => ({
        shouldOverWriteExistingData: service.overrideData,
        serviceName: MIGRATION_SERVICE_NAME_TO_ID[service.name] ?? 0,
      }));

    return {
      projectKey: formData[0].sourceEnvironment,
      targetedProjectKey: formData[0].targetEnvironment,
      tenantGroupId: groupId as string,
      services,
    };
  };

  const handleStartMigration = async () => {
    if (!groupId) {
      showErrorToast({
        errors: { general: tStatic(I18N_MODULE, "REVIEW_CONFIRM_FORM.NO_PROJECT_SELECTED") },
      });
      return;
    }

    try {
      const response = await initiateMigration(buildMigrationPayload());
      if (response.isSuccess && response.verificationId) {
        setVerificationId(response.verificationId);
        setIsVerificationModalOpen(true);
        reset();
        return;
      }
      showErrorToast({
        errors: {
          general: tStatic(I18N_MODULE, "REVIEW_CONFIRM_FORM.FAILED_TO_INITIATE_MIGRATION"),
        },
      });
    } catch {
      showErrorToast({
        errors: {
          general: tStatic(I18N_MODULE, "REVIEW_CONFIRM_FORM.AN_ERROR_OCCURRED_WHILE_INITIATING"),
        },
      });
    }
  };

  const handleResendVerification = async () => {
    if (!groupId) {
      showErrorToast({
        errors: { general: tStatic(I18N_MODULE, "REVIEW_CONFIRM_FORM.NO_PROJECT_SELECTED") },
      });
      return;
    }

    try {
      const response = await initiateMigration(buildMigrationPayload());
      if (response.isSuccess && response.verificationId) {
        setVerificationId(response.verificationId);
        reset();
        showSuccessToast({
          description: t("REVIEW_CONFIRM_FORM.VERIFICATION_CODE_SENT"),
        });
        return;
      }
      showErrorToast({
        errors: {
          general: tStatic(I18N_MODULE, "REVIEW_CONFIRM_FORM.FAILED_TO_RESEND_VERIFICATION_CODE"),
        },
      });
    } catch {
      showErrorToast({
        errors: {
          general: tStatic(I18N_MODULE, "REVIEW_CONFIRM_FORM.AN_ERROR_OCCURRED_WHILE_RESENDING"),
        },
      });
    }
  };

  const handleVerifyMigration = async (values: { verificationCode: string }) => {
    try {
      const response = await verifyMigration({
        verificationId,
        verificationCode: values.verificationCode,
        tenantGroupId: groupId ?? "",
      });

      if (response.isSuccess && response.isValid) {
        showSuccessToast({ description: t("REVIEW_CONFIRM_FORM.MIGRATION_HAS_BEEN_STARTED_YOU") });
        setIsVerificationModalOpen(false);
        navigate(groupId ? `/app/project/${groupId}/environments` : "/app/console");
        return;
      }
      showErrorToast({
        errors: { general: tStatic(I18N_MODULE, "REVIEW_CONFIRM_FORM.INVALID_VERIFICATION_CODE") },
      });
    } catch {
      showErrorToast({
        errors: {
          general: tStatic(
            I18N_MODULE,
            "REVIEW_CONFIRM_FORM.AN_ERROR_OCCURRED_DURING_VERIFICATION",
          ),
        },
      });
    }
  };

  const selectedServices = formData[0].services.filter((service) => service.selected);

  return (
    <>
      <div className="mt-4 flex flex-col gap-6 text-left">
        <div>
          <p className="text-3xl font-bold tracking-tight">
            {t("REVIEW_CONFIRM_FORM.REVIEW_CONFIRM")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("REVIEW_CONFIRM_FORM.CHECK_THE_DETAILS_BELOW_BEFORE")}
          </p>
        </div>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            {t("REVIEW_CONFIRM_FORM.YOU_ARE_ABOUT_TO_MIGRATE", {
              strong: t("REVIEW_CONFIRM_FORM.PLEASE_NOTE"),
            })}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("REVIEW_CONFIRM_FORM.SUMMARY")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("REVIEW_CONFIRM_FORM.SOURCE_ENVIRONMENT")}
                </p>
                <p className="text-base font-medium">
                  {formData[0].sourceEnvironmentName || formData[0].sourceEnvironment}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t("REVIEW_CONFIRM_FORM.TARGET_ENVIRONMENT")}
                </p>
                <p className="text-base font-medium">
                  {formData[0].targetEnvironmentName || formData[0].targetEnvironment}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                {t("REVIEW_CONFIRM_FORM.SERVICES_SELECTED")}
              </p>
              <TooltipProvider>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {selectedServices.map((service) => (
                    <Tooltip key={service.name}>
                      <TooltipTrigger type="button" asChild>
                        <div className="flex cursor-pointer items-center p-2 transition-colors">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full">
                            <Check className="h-4 w-4 text-[#17C964]" />
                          </div>
                          <span className="ml-2 text-sm font-medium text-foreground">
                            {service.label}
                          </span>
                          {service.overrideData && (
                            <AlertTriangle className="ml-1 h-4 w-4 text-amber-500" />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs text-muted-foreground">
                          {service.overrideData
                            ? t("REVIEW_CONFIRM_FORM.THIS_WILL_OVERWRITE_EXISTING_DATA")
                            : t("REVIEW_CONFIRM_FORM.OVERWRITING_DATA_DISABLED")}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={handleStartMigration}
            disabled={isInitiating || selectedServices.length === 0}
          >
            {isInitiating
              ? t("REVIEW_CONFIRM_FORM.STARTING_MIGRATION")
              : t("REVIEW_CONFIRM_FORM.START_MIGRATION")}
          </Button>
        </div>
      </div>

      <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("REVIEW_CONFIRM_FORM.VERIFY_YOUR_MIGRATION")}</DialogTitle>
            <DialogDescription>
              {t("REVIEW_CONFIRM_FORM.YOU_RE_ABOUT_TO_MIGRATE", {
                strong: `${formData[0].sourceEnvironmentName || formData[0].sourceEnvironment}`,
                strong2: `${formData[0].targetEnvironmentName || formData[0].targetEnvironment}`,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-medium-emphasis">
              {t("REVIEW_CONFIRM_FORM.WE_VE_SENT_A_VERIFICATION")}
            </p>

            <Form {...verificationForm}>
              <form
                onSubmit={verificationForm.handleSubmit(handleVerifyMigration)}
                className="space-y-4"
              >
                <FormField
                  control={verificationForm.control}
                  name="verificationCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("REVIEW_CONFIRM_FORM.VERIFICATION_CODE")}</FormLabel>
                      <FormControl>
                        <InputOTP maxLength={5} {...field}>
                          <InputOTPGroup className="gap-4">
                            <CustomInputOTPSlot index={0} />
                            <CustomInputOTPSlot index={1} />
                            <CustomInputOTPSlot index={2} />
                            <CustomInputOTPSlot index={3} />
                            <CustomInputOTPSlot index={4} />
                          </InputOTPGroup>
                        </InputOTP>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="text-sm text-medium-emphasis">
                  <p>
                    {t("REVIEW_CONFIRM_FORM.DID_NOT_RECEIVE_MAIL")}{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 text-sm font-medium no-underline!"
                      disabled={!!remainingTime || isInitiating}
                      onClick={handleResendVerification}
                    >
                      {remainingTime
                        ? t("REVIEW_CONFIRM_FORM.RESEND_IN", {
                            value1: Math.floor(remainingTime / 60),
                            value2: String(remainingTime % 60).padStart(2, "0"),
                          })
                        : t("REVIEW_CONFIRM_FORM.RESEND")}
                    </Button>
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsVerificationModalOpen(false)}
                    disabled={isVerifying}
                  >
                    {t("common:CANCEL")}
                  </Button>
                  <Button type="submit" disabled={isVerifying}>
                    {isVerifying
                      ? t("REVIEW_CONFIRM_FORM.VERIFYING")
                      : t("REVIEW_CONFIRM_FORM.VERIFY_BEGIN")}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

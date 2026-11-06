import { Logo } from "@/components/logo";
import { Button } from "@/components/ui-kits/button/button";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { Link } from "react-router";
import { useT } from "@seliseblocks/genesis-os";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import {
  useAccountActivationCodeExpiration,
  useAccountResendActivation,
} from "@blocks-idp/iam/hooks/use-account";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ActivationForm } from "./activation-form";
import { ActivationErrorState, isAlreadyActivatedSignal } from "./utils";
type ActivationProps = {
  code?: string;
  lang?: string;
};
const xBlocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");

export const Activation = ({ code }: ActivationProps) => {
  const { t } = useT("os.idp.auth");
  const { isPending: isActivationPending, mutateAsync: activationCodeValidation } =
    useAccountActivationCodeExpiration();
  const { mutateAsync: resendActivationLink, isPending: isResendPending } =
    useAccountResendActivation();
  const [isValidCode, setIsValidCode] = useState<boolean | null>(null);
  const [activationError, setActivationError] = useState<ActivationErrorState | null>(null);
  const [activationUserId, setActivationUserId] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  // With no code there is nothing to validate: show the invalid state straight away, and again
  // whenever the code goes away.
  const [checkedCode, setCheckedCode] = useState<{ code: string | undefined } | null>(null);
  if (checkedCode === null || checkedCode.code !== code) {
    setCheckedCode({ code });
    if (!code) {
      setActivationError("invalid");
      setActivationUserId(null);
      setResendMessage(null);
      setResendSuccess(false);
      setIsValidCode(false);
    }
  }
  useEffect(() => {
    if (!code) return;
    const validateCode = async () => {
      try {
        const res = await activationCodeValidation({
          projectKey: xBlocksKey,
          activationCode: code,
        });
        setResendMessage(null);
        setResendSuccess(false);
        // Backend contract (ValidateAccountActivationCodeAsync):
        //   isSuccess true (+ userId)  -> code is valid and still pending -> show the form
        //   already-activated signal   -> account is already set up -> point to sign in
        //   errors present             -> code is invalid
        //   otherwise                  -> code not found / expired (userId may be null)
        if (res.isSuccess) {
          // Valid, pending activation: show the activate account form.
          setActivationError(null);
          setActivationUserId(null);
        } else if (
          res.status === "already_activated" ||
          res.isAlreadyActive ||
          isAlreadyActivatedSignal(res.errors)
        ) {
          setActivationError("already_activated");
          setActivationUserId(null);
        } else if (res.errors != null) {
          setActivationError("invalid");
          setActivationUserId(null);
        } else {
          // Code is gone (expired or already used). Offer resend when we know the user.
          setActivationError("expired");
          setActivationUserId(res.userId ?? null);
        }
        setIsValidCode(res.isSuccess);
      } catch (error) {
        // A non-2xx response throws here (HttpError carries { status, errors }). Read the body instead of
        // collapsing every failure to "invalid", so an already-activated account gets the correct screen.
        const errorBody = (error as { errors?: unknown })?.errors;
        setResendMessage(null);
        setResendSuccess(false);
        setActivationError(isAlreadyActivatedSignal(errorBody) ? "already_activated" : "invalid");
        setActivationUserId(null);
        setIsValidCode(false);
      }
    };
    validateCode();
  }, [code, activationCodeValidation]);
  const handleResendActivation = async () => {
    if (!activationUserId || isResendPending) return;
    try {
      setResendMessage(null);
      setResendSuccess(false);
      const response = await resendActivationLink({
        userId: activationUserId,
        projectKey: xBlocksKey,
      });
      if (response?.isSuccess) {
        setResendSuccess(true);
        setResendMessage(t("ACTIVATION.RESEND_SUCCESS"));
      } else {
        setResendSuccess(false);
        setResendMessage(t("ACTIVATION.RESEND_FAILED"));
      }
    } catch (error) {
      setResendSuccess(false);
      setResendMessage(error instanceof Error ? error.message : t("ACTIVATION.RESEND_ERROR"));
    }
  };
  if (isActivationPending || isValidCode === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>{t("ACTIVATION.VALIDATING")}</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen flex-col items-center bg-background">
      <Link
        to="/login"
        className="mb-4 mt-[30px] cursor-pointer p-4 hover:opacity-80 transition-opacity"
      >
        <Logo src={"/Logo.svg"} width={128} height={54.931} />
      </Link>
      {activationError === null && (
        <Card className="mx-auto w-full rounded border-solid border-background shadow-none sm:max-w-md sm:border-[#95ADC4]">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl leading-9">{t("ACTIVATION.TITLE")}</CardTitle>
            <CardDescription className="mt-2 text-xl text-foreground">
              {t("ACTIVATION.SUBTITLE")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivationForm code={code ?? ""} />
          </CardContent>
        </Card>
      )}
      {activationError === "already_activated" && (
        <Card className="mx-auto w-full max-w-lg rounded-none border-none text-center shadow-none">
          <CardContent className="p-8">
            <CheckCircle2 className="mx-auto flex h-10 w-10 items-center justify-center text-success" />
            <h1 className="text-xl font-semibold">{t("ACTIVATION.ALREADY_ACTIVE_TITLE")}</h1>
            <p className="mt-2 text-sm">{t("ACTIVATION.ALREADY_ACTIVE_MESSAGE")}</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button asChild>
                <Link to="/login">{t("ACTIVATION.GO_TO_SIGN_IN")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {activationError === "invalid" && (
        <Card className="mx-auto w-full max-w-lg rounded-none border-none text-center shadow-none">
          <CardContent className="p-8">
            <AlertTriangle className="mx-auto flex h-10 w-10 items-center justify-center text-amber-600" />
            <h1 className="text-xl font-semibold">{t("ACTIVATION.INVALID_TITLE")}</h1>
            <p className="mt-2 text-sm">{t("ACTIVATION.INVALID_MESSAGE")}</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button asChild variant="outline">
                <Link to="/login">{t("ACTIVATION.GO_TO_SIGN_IN")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {activationError === "expired" && (
        <Card className="mx-auto w-full max-w-lg rounded-none border-none text-center shadow-none">
          <CardContent className="p-8">
            <AlertTriangle className="mx-auto flex h-10 w-10 items-center justify-center text-amber-600" />
            {/* </div> */}
            <h1 className="text-xl font-semibold">{t("ACTIVATION.EXPIRED_TITLE")}</h1>
            <p className="mt-2 text-sm">{t("ACTIVATION.EXPIRED_MESSAGE")}</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button
                onClick={handleResendActivation}
                disabled={!activationUserId || isResendPending || resendSuccess}
              >
                {t("ACTIVATION.RESEND")}
              </Button>
              {resendMessage ? (
                <div className="flex items-center gap-2 text-sm">
                  {resendSuccess ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                  <span className={resendSuccess ? "text-success" : "text-destructive"}>
                    {resendMessage}
                  </span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

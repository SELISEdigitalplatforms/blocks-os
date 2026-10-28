import { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import { showErrorToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import type { IPushTestResult } from "../../models/push.model";
import { PUSH_FORM_TEXT } from "../../constants/push-ui.constant";
import { useSendNotificationTest } from "../../hooks/use-push-runtime";
import type { NotificationFormValues } from "../../utils/notification-form";
import { buildNotificationTestRequest } from "../../utils/push-options";
import { PushTestResultDialog } from "../push-test-result-dialog";
import { HelpText } from "./form-row";

/** "Send test to my devices": sends the unsaved draft with sample data and shows the result dialog. */
export function PushTestRow({ values }: Readonly<{ values: NotificationFormValues }>) {
  const test = useSendNotificationTest();
  const [result, setResult] = useState<IPushTestResult | null>(null);
  const missingKeys = !values.titleKey || !values.bodyKey;

  const run = async () => {
    try {
      const res = await test.mutateAsync(buildNotificationTestRequest(values));
      if (res.isSuccess === false) showErrorToast({ errors: res.errors });
      else setResult(res);
    } catch (error) {
      showErrorToast({ errors: isErrorWithErrors(error) ? error.errors : "Something went wrong" });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <HelpText>{PUSH_FORM_TEXT.previewHelp}</HelpText>
      <div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={missingKeys || test.isPending}
          onClick={() => void run()}
        >
          {PUSH_FORM_TEXT.sendTest}
        </Button>
      </div>
      {missingKeys && <HelpText>{PUSH_FORM_TEXT.needKeys}</HelpText>}
      <PushTestResultDialog
        result={result}
        pending={test.isPending}
        onSendAgain={() => void run()}
        onClose={() => setResult(null)}
      />
    </div>
  );
}

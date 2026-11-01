import type { IPushSettings } from "../../models/push.model";
import { PUSH_FORM_TEXT } from "../../constants/push-ui.constant";
import type { NotificationFormValues } from "../../utils/notification-form";
import { FormRow } from "./form-row";
import { PushOptionsField } from "./push-options-field";
import { PushPlatformsField } from "./push-platforms-field";
import { PushTestRow } from "./push-test-row";

interface RowsProps {
  values: NotificationFormValues;
  onPatch: (patch: Partial<NotificationFormValues>) => void;
}

/** Which platforms the push goes to, above the message rows. */
export function PushPlatformsRow({
  values,
  onPatch,
  settings,
}: Readonly<RowsProps & { settings?: IPushSettings }>) {
  return (
    <FormRow label={PUSH_FORM_TEXT.platforms}>
      <PushPlatformsField
        selected={values.pushPlatforms}
        settings={settings}
        onChange={(pushPlatforms) => onPatch({ pushPlatforms })}
      />
    </FormRow>
  );
}

/** Platform options and the test send, below the message rows. */
export function PushOptionsRows({ values, onPatch }: Readonly<RowsProps>) {
  return (
    <>
      <FormRow label={PUSH_FORM_TEXT.options}>
        <PushOptionsField
          values={values.pushOptions}
          onChange={(pushOptions) => onPatch({ pushOptions })}
        />
      </FormRow>
      <FormRow label={PUSH_FORM_TEXT.previewTitle}>
        <PushTestRow values={values} />
      </FormRow>
    </>
  );
}

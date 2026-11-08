import type { IAction } from "../models/actions.model";

export const makeAction = (over: Partial<IAction> = {}): IAction => ({
  name: "iam.user.created",
  label: "User created",
  service: "IAM",
  payload: { userId: "string", mfaEnabled: "bool" },
  workflow: false,
  function: false,
  webhook: true,
  ...over,
});

export const sampleActions: IAction[] = [
  makeAction(),
  makeAction({
    name: "iam.organization.created",
    label: "Organization created",
    payload: { organizationId: "string", defaultRoleForMembers: "string[]" },
    webhook: false,
  }),
  makeAction({
    name: "localization.files.generated",
    label: "Files generated",
    service: "Localization",
    payload: { generationId: "string", isSuccess: "bool" },
    webhook: true,
  }),
];

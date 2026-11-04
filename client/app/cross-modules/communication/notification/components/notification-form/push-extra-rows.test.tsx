import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ANDROID_FIELDS } from "../../constants/push-ui.constant";
import { EMPTY_FORM_VALUES } from "../../utils/notification-form";

vi.mock("../../hooks/use-push-runtime", () => ({
  useSendNotificationTest: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { PushOptionsRows, PushPlatformsRow } from "./push-extra-rows";

describe("push form rows", () => {
  it("unticking a platform patches the chosen platforms only", async () => {
    const onPatch = vi.fn();
    render(<PushPlatformsRow values={EMPTY_FORM_VALUES} onPatch={onPatch} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "iOS" }));
    expect(onPatch).toHaveBeenCalledWith({ pushPlatforms: ["android", "web"] });
  });

  it("typing an option patches the options of the draft", async () => {
    const onPatch = vi.fn();
    render(<PushOptionsRows values={EMPTY_FORM_VALUES} onPatch={onPatch} />);
    await userEvent.type(screen.getByLabelText(ANDROID_FIELDS.sound), "d");
    expect(onPatch).toHaveBeenCalledWith({
      pushOptions: expect.objectContaining({
        android: expect.objectContaining({ sound: "d" }),
      }),
    });
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { IPushSettings } from "../../models/push.model";
import { PushPlatformsField } from "./push-platforms-field";

const SETTINGS: IPushSettings = {
  projectId: "p",
  enabled: true,
  hasKey: true,
  platforms: { android: true, ios: true, web: false },
  hasWebConfig: false,
};

describe("PushPlatformsField", () => {
  it("marks a platform that is off in the settings and keeps the other choices when one is ticked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PushPlatformsField selected={["android"]} settings={SETTINGS} onChange={onChange} />);
    expect(screen.getByLabelText(/Web \(off in settings\)/)).toBeTruthy();
    await user.click(screen.getByLabelText("iOS"));
    expect(onChange).toHaveBeenCalledWith(["android", "ios"]);
  });
});

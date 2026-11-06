import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ANDROID_FIELDS, IOS_FIELDS, WEB_FIELDS } from "../../constants/push-ui.constant";
import { buildPushOptions, EMPTY_PUSH_OPTIONS } from "../../utils/push-options";
import type { PushOptionValues } from "../../utils/push-options";
import { PushOptionsField } from "./push-options-field";

const latest = { current: EMPTY_PUSH_OPTIONS };
const GROUP = "news";

function Harness({ initial = EMPTY_PUSH_OPTIONS }: Readonly<{ initial?: PushOptionValues }>) {
  const [values, setValues] = useState(initial);
  const change = (next: PushOptionValues) => {
    latest.current = next;
    setValues(next);
  };
  return <PushOptionsField values={values} onChange={change} />;
}

const openTab = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole("tab", { name }));

const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(screen.getByRole("option", { name: option }));
};

describe("PushOptionsField", () => {
  it("keeps what was typed for each platform when the tab changes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(ANDROID_FIELDS.channel), "orders");
    await openTab(user, "iOS");
    await user.type(screen.getByLabelText(IOS_FIELDS.thread), GROUP);
    await openTab(user, "Android");
    expect((screen.getByLabelText(ANDROID_FIELDS.channel) as HTMLInputElement).value).toBe(
      "orders",
    );
    expect(latest.current.ios.threadId).toBe(GROUP);
  });

  it("a chosen expiry and priority land in the request, and Default sends nothing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await choose(user, ANDROID_FIELDS.expires, "1 day");
    await choose(user, ANDROID_FIELDS.priority, "Normal");
    expect(buildPushOptions(latest.current).android).toEqual({
      priority: "normal",
      ttlSeconds: 86400,
    });

    await choose(user, ANDROID_FIELDS.expires, "Default");
    await choose(user, ANDROID_FIELDS.priority, "Default");
    expect(buildPushOptions(latest.current).android).toBeNull();
  });

  it("iOS: interruption level, expiry and badge land in the request", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openTab(user, "iOS");
    await choose(user, IOS_FIELDS.interruption, "Time-sensitive");
    await choose(user, IOS_FIELDS.expires, "1 week");
    await user.type(screen.getByLabelText(IOS_FIELDS.badge), "3");
    expect(buildPushOptions(latest.current).ios).toEqual({
      badge: 3,
      interruptionLevel: "time-sensitive",
      ttlSeconds: 604800,
    });
  });

  it("web: urgency and stay-until-clicked land in the request", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openTab(user, "Web");
    await choose(user, WEB_FIELDS.urgency, "High");
    await user.click(screen.getByRole("checkbox", { name: WEB_FIELDS.requireInteraction }));
    expect(buildPushOptions(latest.current).web).toEqual({
      requireInteraction: true,
      urgency: "high",
    });
  });

  it("typed text of every platform lands in the request", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText(ANDROID_FIELDS.sound), "ding");
    await user.type(screen.getByLabelText(ANDROID_FIELDS.collapseKey), "orders");
    await user.type(screen.getByLabelText(ANDROID_FIELDS.color), "#0B5CAD");
    await openTab(user, "iOS");
    await user.type(screen.getByLabelText(IOS_FIELDS.sound), "pop.caf");
    await choose(user, IOS_FIELDS.priority, "High — show now");
    await openTab(user, "Web");
    await user.type(screen.getByLabelText(WEB_FIELDS.icon), "https://x.test/i.png");
    await choose(user, WEB_FIELDS.expires, "4 weeks");
    const built = buildPushOptions(latest.current);
    expect(built.android).toEqual({ sound: "ding", collapseKey: "orders", color: "#0B5CAD" });
    expect(built.ios).toEqual({ sound: "pop.caf", priority: "high" });
    expect(built.web).toEqual({ icon: "https://x.test/i.png", ttlSeconds: 2419200 });
  });

  it("a stored value that is not in the list stays visible and is kept", async () => {
    const onChange = vi.fn();
    const stored = {
      ...EMPTY_PUSH_OPTIONS,
      android: { ...EMPTY_PUSH_OPTIONS.android, ttl: "120" },
    };
    render(<PushOptionsField values={stored} onChange={onChange} />);
    expect(screen.getByRole("combobox", { name: ANDROID_FIELDS.expires }).textContent).toBe("120");
  });
});

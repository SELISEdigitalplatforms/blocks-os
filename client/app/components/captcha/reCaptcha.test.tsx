import { render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReCaptcha } from "./reCaptcha";
import type { CaptchaRef } from "./index.type";

type Grecaptcha = NonNullable<Window["grecaptcha"]>;

const makeGrecaptcha = (renderReturn = 42): Grecaptcha => ({
  render: vi.fn(() => renderReturn),
  ready: vi.fn((cb: () => void) => cb()),
  reset: vi.fn(),
});

const SCRIPT_ID = "blocks-recaptcha-script";

describe("ReCaptcha", () => {
  beforeEach(() => {
    delete (window as { grecaptcha?: Grecaptcha }).grecaptcha;
    document.getElementById(SCRIPT_ID)?.remove();
  });

  afterEach(() => {
    delete (window as { grecaptcha?: Grecaptcha }).grecaptcha;
    document.getElementById(SCRIPT_ID)?.remove();
  });

  it("renders the widget immediately when grecaptcha is already available", () => {
    const grecaptcha = makeGrecaptcha();
    (window as { grecaptcha?: Grecaptcha }).grecaptcha = grecaptcha;
    const onVerify = vi.fn();
    const onExpired = vi.fn();
    const onError = vi.fn();

    render(
      <ReCaptcha
        type="reCaptcha-v2-checkbox"
        siteKey="site-1"
        theme="dark"
        size="compact"
        onVerify={onVerify}
        onExpired={onExpired}
        onError={onError}
      />,
    );

    expect(grecaptcha.ready).toHaveBeenCalledTimes(1);
    expect(grecaptcha.render).toHaveBeenCalledTimes(1);
    const params = (grecaptcha.render as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(params.sitekey).toBe("site-1");
    expect(params.theme).toBe("dark");
    expect(params.size).toBe("compact");
    expect(params.callback).toBe(onVerify);
    expect(params["expired-callback"]).toBe(onExpired);
    expect(params["error-callback"]).toBe(onError);
  });

  it("omits optional callbacks when not provided", () => {
    const grecaptcha = makeGrecaptcha();
    (window as { grecaptcha?: Grecaptcha }).grecaptcha = grecaptcha;

    render(<ReCaptcha type="reCaptcha-v2-checkbox" siteKey="site-2" onVerify={vi.fn()} />);

    const params = (grecaptcha.render as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect("expired-callback" in params).toBe(false);
    expect("error-callback" in params).toBe(false);
  });

  it("resets the rendered widget through the imperative ref", () => {
    const grecaptcha = makeGrecaptcha(7);
    (window as { grecaptcha?: Grecaptcha }).grecaptcha = grecaptcha;
    const ref = createRef<CaptchaRef>();

    render(
      <ReCaptcha type="reCaptcha-v2-checkbox" ref={ref} siteKey="site-3" onVerify={vi.fn()} />,
    );
    ref.current?.reset();

    expect(grecaptcha.reset).toHaveBeenCalledWith(7);
  });

  it("does not throw on reset before the widget was rendered", () => {
    const ref = createRef<CaptchaRef>();
    render(
      <ReCaptcha type="reCaptcha-v2-checkbox" ref={ref} siteKey="site-4" onVerify={vi.fn()} />,
    );
    expect(() => ref.current?.reset()).not.toThrow();
  });

  it("injects the recaptcha script once and renders after it loads", () => {
    render(<ReCaptcha type="reCaptcha-v2-checkbox" siteKey="site-5" onVerify={vi.fn()} />);

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement;
    expect(script).toBeTruthy();
    expect(script.src).toContain("recaptcha/api.js");

    // grecaptcha becomes available and the script finishes loading
    const grecaptcha = makeGrecaptcha();
    (window as { grecaptcha?: Grecaptcha }).grecaptcha = grecaptcha;
    script.dispatchEvent(new Event("load"));

    expect(grecaptcha.render).toHaveBeenCalledTimes(1);
  });

  it("does not inject a second script tag when one already exists", () => {
    render(<ReCaptcha type="reCaptcha-v2-checkbox" siteKey="site-6" onVerify={vi.fn()} />);
    render(<ReCaptcha type="reCaptcha-v2-checkbox" siteKey="site-7" onVerify={vi.fn()} />);
    expect(document.querySelectorAll(`#${SCRIPT_ID}`).length).toBe(1);
  });
});

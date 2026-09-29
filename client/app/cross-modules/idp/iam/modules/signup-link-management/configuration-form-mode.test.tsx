import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@blocks-idp/authentication/hooks/use-auth-oidc", () => ({
  useGetAuthOidcCredentials: () => ({
    data: {
      oIDCClientCredentials: [
        {
          itemId: "partner-portal",
          clientDisplayName: "Partner Portal",
          redirectUris: [
            "https://partner.example.com/callback",
            "https://partner.example.com/alt",
          ],
          isActive: true,
          isDeviceFlowClient: false,
        },
        {
          itemId: "device-client",
          clientDisplayName: "Device Flow",
          redirectUris: [],
          isActive: true,
          isDeviceFlowClient: true,
        },
        {
          itemId: "retired",
          clientDisplayName: "Retired",
          redirectUris: ["https://retired.example.com/cb"],
          isActive: false,
          isDeviceFlowClient: false,
        },
      ],
    },
    isLoading: false,
  }),
}));

vi.mock(
  "@blocks-idp/authentication/components/create-client-credential/client-credential-roles-section",
  () => ({ ClientCredentialRolesSection: () => <button type="button">Roles</button> }),
);

vi.mock(
  "@blocks-idp/authentication/components/create-client-credential/client-credential-permissions-section",
  () => ({ ClientCredentialPermissionsSection: () => <button type="button">Permissions</button> }),
);

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui-kits/form/form";
import { ConfigurationFormFields } from "./configuration-form-fields";
import {
  signupLinkConfigurationFormDefaults,
  signupLinkConfigurationFormSchema,
  SignupLinkConfigurationFormValues,
} from "./configuration-form-schema";

const Harness = () => {
  const form = useForm<SignupLinkConfigurationFormValues>({
    defaultValues: signupLinkConfigurationFormDefaults,
    resolver: zodResolver(signupLinkConfigurationFormSchema),
  });
  return (
    <Form {...form}>
      <ConfigurationFormFields form={form} />
    </Form>
  );
};

const switchMode = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByTestId("mode-select"));
  await user.click(await screen.findByRole("option", { name: label }));
};

describe("ConfigurationFormFields mode", () => {
  it("shows client and redirect in OIDC mode, and neither in embedded", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByTestId("client-select")).toBeTruthy();

    await switchMode(user, "Embedded construct");

    await waitFor(() => expect(screen.queryByTestId("client-select")).toBeNull());
    expect(screen.queryByTestId("redirect-select")).toBeNull();
    // The server rejects a client on an embedded configuration, so the field must be gone,
    // not merely ignored.
    expect(screen.getByPlaceholderText("https://app.example.com/join (optional)")).toBeTruthy();
  });

  it("offers only active, non-device-flow clients", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId("client-select"));

    expect(await screen.findByRole("option", { name: "Partner Portal" })).toBeTruthy();
    // A device-flow client has no browser redirect and an inactive one is rejected by IAM,
    // so neither is a valid target for a signup link.
    expect(screen.queryByRole("option", { name: "Device Flow" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Retired" })).toBeNull();
  });

  it("lists the chosen client's registered redirect URIs", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId("client-select"));
    await user.click(await screen.findByRole("option", { name: "Partner Portal" }));

    await user.click(await screen.findByTestId("redirect-select"));
    expect(
      await screen.findByRole("option", { name: "https://partner.example.com/callback" }),
    ).toBeTruthy();
    expect(screen.getByRole("option", { name: "https://partner.example.com/alt" })).toBeTruthy();
  });

  it("marks the mandatory fields", () => {
    render(<Harness />);
    // Name, Mode, Client, Credential mode, Lifetime -- roles are deliberately not required.
    expect(screen.getAllByText("*").length).toBeGreaterThanOrEqual(5);
  });
});

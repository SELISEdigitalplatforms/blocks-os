import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getErrorMessage, handleErrorMessages } from "@/lib/error";
import {
  ARCHIVE_ERROR_MESSAGES,
  normalizeArchiveErrors,
} from "@blocks-idp/iam/constants/archive-error-messages";
import { PERMISSION_ENDPOINTS, ROLE_ENDPOINTS } from "@blocks-idp/iam/constants/endpoint.constant";
import { ArchiveAction } from "@blocks-idp/iam/components/archive-action";
import { permissionService } from "./permission.service";
import { roleService } from "./role.service";

// See the mock for why the tooltip barrel cannot be imported under jsdom.
vi.mock(
  "@/components/ui-kits/tooltip/tooltip",
  () => import("@/test-utils/__mocks__/tooltip.mock"),
);

const errorToast = vi.fn();
const successToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  // The real handleErrorMessages still runs, so the assertions below see the string the user
  // would read rather than the arguments the component happened to pass -- which is what let the
  // array-collapsing bug hide behind a green test.
  showErrorToast: ({
    errors,
    customMessages,
  }: {
    errors: unknown;
    customMessages?: Record<string, string>;
  }) => {
    errorToast(handleErrorMessages(errors as never, customMessages));
  },
  showSuccessToast: () => successToast(),
}));

/**
 * Contract tests for the archive endpoints.
 *
 * These live in their own file **without** the `vi.mock("@/lib/http/http-client")` that both
 * service suites hoist: with that mock in place a stubbed `fetch` never reaches the real
 * `HttpClient`, so `throwIfNotOk` would not run and the normalisation this file exists to prove
 * would go untested while appearing covered.
 */
describe("archive endpoint contract", () => {
  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  const endpoints = [
    {
      name: "role",
      call: (id: string) => roleService.deleteRole(id),
      url: `${ROLE_ENDPOINTS.GET_ROLES}/role-1`,
      id: "role-1",
      code: "Role_Has_Child_Roles",
      pascalCode: "Role_Already_Archived",
    },
    {
      name: "permission",
      call: (id: string) => permissionService.deletePermission(id),
      url: `${PERMISSION_ENDPOINTS.GET_PERMISSIONS}/perm-1`,
      id: "perm-1",
      code: "Permission_Already_Archived",
      pascalCode: "Permission_Not_Found",
    },
  ];

  it.each(endpoints)("$name: issues a DELETE to exactly the by-id route", async (e) => {
    // Full-URL equality, not a substring: `toContain("/iam/roles/role-1")` would also pass for a
    // wrong host or a doubled path segment.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { isSuccess: true }));
    vi.stubGlobal("fetch", fetchMock);

    await e.call(e.id);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(e.url);
    expect(init?.method).toBe("DELETE");
  });

  const archiveAndCatch = async (e: (typeof endpoints)[number]) => {
    try {
      await e.call(e.id);
      return undefined;
    } catch (error) {
      return error;
    }
  };

  it.each(endpoints)("$name: carries a 400's reason code through to mapped copy", async (e) => {
    // The whole chain: fetch -> throwIfNotOk -> HttpError.errors -> normalize -> message map.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, { isSuccess: false, errors: { dependency: e.code } }),
      ),
    );

    const errors = normalizeArchiveErrors(await archiveAndCatch(e));

    expect(errors).toEqual({ dependency: e.code });
    expect(getErrorMessage(errors!, ARCHIVE_ERROR_MESSAGES)).toEqual([
      ARCHIVE_ERROR_MESSAGES[e.code],
    ]);
  });

  it.each(endpoints)("$name: carries the code through a PascalCase body", async (e) => {
    // throwIfNotOk only recognises a lowercase `errors`, so a PascalCase body arrives with the
    // whole response object attached instead. ASP.NET Core's defaults give lowercase and
    // blocks-iam sets no naming policy, but that is a separate repo on a separate deploy.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(400, { isSuccess: false, Errors: { archived: e.pascalCode } }),
      ),
    );

    const errors = normalizeArchiveErrors(await archiveAndCatch(e));

    expect(errors).toEqual({ archived: e.pascalCode });
    expect(getErrorMessage(errors!, ARCHIVE_ERROR_MESSAGES)).toEqual([
      ARCHIVE_ERROR_MESSAGES[e.pascalCode],
    ]);
  });

  describe("what the user actually sees", () => {
    // C2 and C7 end to end: ArchiveAction driven by the real service over a stubbed socket, with
    // the real handleErrorMessages. Recomputing a message in the test would have re-implemented
    // the component's own logic and missed the array-collapsing bug entirely.
    const renderAction = () =>
      render(
        <ArchiveAction
          entity="role"
          name="Administrator"
          itemId="role-1"
          archive={(id) => roleService.deleteRole(id) as Promise<unknown>}
          isPending={false}
        />,
      );

    const confirm = async () => {
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Archive role Administrator" }));
      await user.click(screen.getByRole("button", { name: "Archive" }));
    };

    it("shows the mapped copy for a rejected archive", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(400, {
            isSuccess: false,
            errors: { dependency: "Role_Has_Child_Roles" },
          }),
        ),
      );

      renderAction();
      await confirm();

      // An array, because showErrorToast renders one line per mapped message.
      expect(errorToast).toHaveBeenCalledWith([ARCHIVE_ERROR_MESSAGES.Role_Has_Child_Roles]);
      expect(successToast).not.toHaveBeenCalled();
    });

    it("falls back to the raw code when the backend adds a reason", async () => {
      // C7: drift degrades to the code rather than a blank or generic toast.
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(400, { isSuccess: false, errors: { forbidden: "Some_Future_Code" } }),
        ),
      );

      renderAction();
      await confirm();

      expect(errorToast).toHaveBeenCalledWith(["Some_Future_Code"]);
    });

    it("shows the archive fallback rather than a blank toast for an empty reason", async () => {
      // A dictionary with a blank value is a shape the backend should not send, but it used to
      // render one empty line in the toast, which reads as a silent failure.
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(400, { isSuccess: false, errors: { dependency: "" } }),
        ),
      );

      renderAction();
      await confirm();

      expect(errorToast).toHaveBeenCalledWith("Something went wrong.");
    });

    it("maps reason codes that arrive as an array", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          jsonResponse(400, {
            isSuccess: false,
            errors: { dependency: ["Role_Has_Child_Roles", "Role_Has_Active_User_Assignments"] },
          }),
        ),
      );

      renderAction();
      await confirm();

      expect(errorToast).toHaveBeenCalledWith([
        `${ARCHIVE_ERROR_MESSAGES.Role_Has_Child_Roles}, ${ARCHIVE_ERROR_MESSAGES.Role_Has_Active_User_Assignments}`,
      ]);
    });

    it("shows a real message on a transport failure", async () => {
      // C2. Rejecting a mocked mutateAsync with a bare Error would skip the client's own
      // normalisation, which is exactly the path this criterion is about.
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

      renderAction();
      await confirm();

      expect(errorToast).toHaveBeenCalledWith("Something went wrong while archiving.");
      expect(successToast).not.toHaveBeenCalled();
    });
  });
});

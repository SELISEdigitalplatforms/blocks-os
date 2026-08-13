import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SECRET_STATUS, SECRET_TYPE } from "@/cross-modules/secrets/models/secret.model";
import { SECRET_ID, makeSecret } from "@/cross-modules/secrets/test-utils/secret.fixtures";

vi.mock("@/cross-modules/secrets/hooks/use-access-labels", () => ({
  useResolvedUserNames: (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, id === "u-1" ? "Ada Lovelace" : id])),
  useResolvedRoleNames: (slugs: string[]) =>
    Object.fromEntries(slugs.map((slug) => [slug, slug === "admin" ? "Administrator" : slug])),
}));

import { SecretDetail } from "./secret-detail";

describe("SecretDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the secret id, description and audit trail fields", () => {
    render(<SecretDetail secret={makeSecret()} />);
    expect(screen.getByText(SECRET_ID)).toBeTruthy();
    expect(screen.getByText("Used by the checkout service")).toBeTruthy();
    expect(screen.getByText("Created")).toBeTruthy();
    expect(screen.getByText("Last updated")).toBeTruthy();
  });

  it("never shows vault coordinates or the retired key-value fields", () => {
    // SecretResult carries no vault name, URI or version — that is deliberate, not an omission.
    render(<SecretDetail secret={makeSecret()} />);
    expect(screen.queryByText(/key vault/i)).toBeNull();
    expect(screen.queryByText(/vault\.azure\.net/i)).toBeNull();
    expect(screen.queryByText(/managed by/i)).toBeNull();
    expect(screen.queryByText(/resource reference/i)).toBeNull();
    expect(screen.queryByText(/version/i)).toBeNull();
  });

  it("hides rotation details until the secret has been rotated", () => {
    render(<SecretDetail secret={makeSecret()} />);
    expect(screen.queryByText("Rotations")).toBeNull();
  });

  it("shows the rotation count and last rotation once there is one", () => {
    render(
      <SecretDetail
        secret={makeSecret({
          rotationCount: 3,
          lastRotatedDate: "2026-03-02T08:00:00Z",
          lastRotatedBy: "user-9",
        })}
      />,
    );
    expect(screen.getByText("Rotations")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText(/last 02 Mar 2026/)).toBeTruthy();
  });

  it("shows dates without trailing actor GUIDs", () => {
    // The API returns actors as raw GUIDs; a 36-character id after every timestamp is noise.
    // "Who" belongs in the audit log, where it is resolved and searchable.
    render(
      <SecretDetail
        secret={makeSecret({
          createdBy: "df1abb8e-0433-4dc0-a01c-e9b6c875824b",
          lastUpdatedBy: "df1abb8e-0433-4dc0-a01c-e9b6c875824b",
          rotationCount: 2,
          lastRotatedDate: "2026-03-02T08:00:00Z",
          lastRotatedBy: "df1abb8e-0433-4dc0-a01c-e9b6c875824b",
        })}
      />,
    );

    expect(screen.queryByText(/df1abb8e/)).toBeNull();
    // No "by <actor>" line anywhere; the description legitimately contains the word "by",
    // so match the rendered pattern rather than the bare word.
    expect(screen.queryByText(/^by\s/)).toBeNull();
    expect(screen.getByText("Created")).toBeTruthy();
  });

  it("shows deletion details for a deleted secret", () => {
    render(
      <SecretDetail
        secret={makeSecret({
          status: SECRET_STATUS.Deleted,
          deletedDate: "2026-03-05T12:00:00Z",
          deletedBy: "user-2",
        })}
      />,
    );
    expect(screen.getByText("Deleted")).toBeTruthy();
  });

  describe("api secrets", () => {
    it("resolves user ids and role slugs to display names", () => {
      render(
        <SecretDetail
          secret={makeSecret({ access: { userIds: ["u-1"], roles: ["admin"] } })}
        />,
      );
      expect(screen.getByText("Ada Lovelace")).toBeTruthy();
      expect(screen.getByText("Administrator")).toBeTruthy();
    });

    it("falls back to the raw identifier when a lookup finds nothing", () => {
      // An id that cannot be resolved still has to be visible.
      render(
        <SecretDetail secret={makeSecret({ access: { userIds: ["u-unknown"], roles: [] } })} />,
      );
      expect(screen.getByText("u-unknown")).toBeTruthy();
    });

    it("explains that an empty access list means the creator and root, not everyone", () => {
      render(<SecretDetail secret={makeSecret({ access: { userIds: [], roles: [] } })} />);
      expect(
        screen.getByText("Only the creator and platform administrators can read this secret."),
      ).toBeTruthy();
    });
  });

  describe("service secrets", () => {
    it("shows no access lists and no explanatory note", () => {
      // The category badge already says "Platform service"; repeating it as prose under every
      // such row was noise.
      render(<SecretDetail secret={makeSecret({ type: SECRET_TYPE.Service, access: null })} />);
      expect(screen.queryByText("Allowed users")).toBeNull();
      expect(screen.queryByText("Allowed roles")).toBeNull();
      expect(screen.queryByText(/consumed by backend services/i)).toBeNull();
    });

    it("does not claim they are unreadable by users", () => {
      // CheckValueRead lets any authenticated caller in the tenant read a service value, so
      // any such claim in the UI would be false.
      render(<SecretDetail secret={makeSecret({ type: SECRET_TYPE.Service, access: null })} />);
      expect(screen.queryByText(/cannot be (read|revealed)/i)).toBeNull();
      expect(screen.queryByText(/not readable/i)).toBeNull();
    });
  });
});

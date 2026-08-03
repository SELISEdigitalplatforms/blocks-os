import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IStorageConfiguration } from "@blocks-storage/models/storage.model";

const h = vi.hoisted(() => ({
  data: [] as IStorageConfiguration[] | undefined,
  isLoading: false,
  isFetching: false,
}));

vi.mock("@blocks-storage/hooks/use-storage-configuration", () => ({
  useGetStorageConfigurations: () => ({
    data: h.data,
    isLoading: h.isLoading,
    isFetching: h.isFetching,
  }),
}));

vi.mock(
  "../storage-configuration/save-storage-configuration/save-storage-configuration",
  () => ({
    SaveStorageConfiguration: () => <div data-testid="save-config" />,
  }),
);

vi.mock("./components/storage-filters-toolbar", () => ({
  StorageFiltersToolbar: ({
    onChange,
    onReset,
    onAddConfiguration,
  }: {
    onChange: (key: string, value: unknown) => void;
    onReset: () => void;
    onAddConfiguration: () => void;
  }) => (
    <div>
      <button onClick={() => onChange("search", "azure")}>filter-azure</button>
      <button onClick={() => onChange("providers", ["AWS"])}>filter-aws-provider</button>
      <button onClick={onReset}>reset</button>
      <button onClick={onAddConfiguration}>add</button>
    </div>
  ),
}));

vi.mock("./components/storage-card", () => ({
  StorageCard: ({
    data,
    onViewDetails,
  }: {
    data: { id: string; title: string; subtitle: string };
    onViewDetails: (id: string) => void;
  }) => (
    <button onClick={() => onViewDetails(data.id)}>
      card:{data.title}:{data.subtitle}
    </button>
  ),
}));

vi.mock("./components/storage-details-drawer", () => ({
  StorageDetailsDrawer: ({
    open,
    storage,
  }: {
    open: boolean;
    storage: IStorageConfiguration | null;
  }) => (open ? <div data-testid="drawer">drawer:{storage?.name}</div> : null),
}));

import { StorageContents } from "./storage-contents";

const config = (over: Partial<IStorageConfiguration> = {}): IStorageConfiguration =>
  ({
    itemId: "id-1",
    name: "My Bucket",
    storageStrategy: "AWS",
    ...over,
  }) as IStorageConfiguration;

describe("StorageContents", () => {
  beforeEach(() => {
    h.data = [];
    h.isLoading = false;
    h.isFetching = false;
  });

  it("shows loading skeletons while configurations are loading", () => {
    h.isLoading = true;
    const { container } = render(<StorageContents />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText(/^card:/)).toBeNull();
  });

  it("renders the empty state when no configuration matches", () => {
    h.data = [];
    render(<StorageContents />);
    expect(screen.getByText("No storage configurations found.")).toBeTruthy();
  });

  it("maps each strategy to its subtitle and pins the Default configuration first", () => {
    h.data = [
      config({ itemId: "aws", name: "AwsOne", storageStrategy: "AWS" }),
      config({ itemId: "az", name: "AzureOne", storageStrategy: "Azure" }),
      config({ itemId: "s3", name: "S3One", storageStrategy: "S3Compatible" }),
      config({ itemId: "sftp", name: "SftpOne", storageStrategy: "SFTP" }),
      config({ itemId: "def", name: "Default", storageStrategy: "AWS" }),
    ];
    render(<StorageContents />);
    const cards = screen.getAllByText(/^card:/).map((el) => el.textContent);
    // Default has been moved to the front of the list.
    expect(cards[0]).toContain("Default");
    expect(cards.some((c) => c?.includes("AwsOne:AWS"))).toBe(true);
    expect(cards.some((c) => c?.includes("AzureOne:Azure"))).toBe(true);
    expect(cards.some((c) => c?.includes("S3One:AWS S3 Compatible"))).toBe(true);
    expect(cards.some((c) => c?.includes("SftpOne:SFTP"))).toBe(true);
  });

  it("filters the cards by the search term and can reset", async () => {
    const user = userEvent.setup();
    h.data = [
      config({ itemId: "aws", name: "AwsOne", storageStrategy: "AWS" }),
      config({ itemId: "az", name: "AzureBucket", storageStrategy: "Azure" }),
    ];
    render(<StorageContents />);
    expect(screen.getAllByText(/^card:/).length).toBe(2);

    await user.click(screen.getByText("filter-azure"));
    const filtered = screen.getAllByText(/^card:/);
    expect(filtered.length).toBe(1);
    expect(filtered[0].textContent).toContain("AzureBucket");

    await user.click(screen.getByText("reset"));
    expect(screen.getAllByText(/^card:/).length).toBe(2);
  });

  it("filters by provider selection", async () => {
    const user = userEvent.setup();
    h.data = [
      config({ itemId: "aws", name: "AwsOne", storageStrategy: "AWS" }),
      config({ itemId: "az", name: "AzureBucket", storageStrategy: "Azure" }),
    ];
    render(<StorageContents />);
    await user.click(screen.getByText("filter-aws-provider"));
    const filtered = screen.getAllByText(/^card:/);
    expect(filtered.length).toBe(1);
    expect(filtered[0].textContent).toContain("AwsOne");
  });

  it("opens the details drawer for the selected storage card", async () => {
    const user = userEvent.setup();
    h.data = [config({ itemId: "id-1", name: "My Bucket", storageStrategy: "AWS" })];
    render(<StorageContents />);
    expect(screen.queryByTestId("drawer")).toBeNull();
    await user.click(screen.getByText(/card:My Bucket/));
    expect(screen.getByTestId("drawer").textContent).toContain("My Bucket");
  });
});

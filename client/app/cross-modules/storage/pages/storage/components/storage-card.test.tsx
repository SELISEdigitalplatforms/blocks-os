import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StorageCard, type StorageCardData } from "./storage-card";

const data = (over: Partial<StorageCardData> = {}): StorageCardData => ({
  id: "s1",
  provider: "AWS",
  providerIcon: "",
  providerColor: "",
  title: "My bucket",
  subtitle: "us-east-1",
  ...over,
});

describe("StorageCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the title and subtitle", () => {
    render(<StorageCard data={data()} />);
    expect(screen.getByText("My bucket")).toBeTruthy();
    expect(screen.getByText("us-east-1")).toBeTruthy();
    expect(screen.getByAltText("AWS")).toBeTruthy();
  });

  it("renders the Azure icon for Azure storage", () => {
    render(<StorageCard data={data({ provider: "Azure" })} />);
    expect(screen.getByAltText("Azure")).toBeTruthy();
  });

  it("renders a package icon for SFTP storage", () => {
    const { container } = render(<StorageCard data={data({ provider: "SftpStorage" })} />);
    expect(container.querySelector(".lucide-package-open")).toBeTruthy();
  });

  it("calls onClick with the card id when the card is clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<StorageCard data={data()} onClick={onClick} />);
    await user.click(screen.getByText("My bucket"));
    expect(onClick).toHaveBeenCalledWith("s1");
  });

  it("opens the menu and triggers view details without firing the card click", async () => {
    const onClick = vi.fn();
    const onViewDetails = vi.fn();
    const user = userEvent.setup();
    render(<StorageCard data={data()} onClick={onClick} onViewDetails={onViewDetails} />);
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("View Details"));
    expect(onViewDetails).toHaveBeenCalledWith("s1");
    expect(onClick).not.toHaveBeenCalled();
  });
});

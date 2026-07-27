import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { LMTQueryAgentChatInput } from "./lmt-query-agent-chat-input";
import type { LmtQueryAgentForm } from "./utils";

const Harness = ({
  isThinking = false,
  onSubmit = vi.fn(),
  onKeyDown,
}: {
  isThinking?: boolean;
  onSubmit?: (d: LmtQueryAgentForm) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) => {
  const form = useForm<LmtQueryAgentForm>({ defaultValues: { query: "" } });
  return (
    <LMTQueryAgentChatInput
      form={form}
      isThinking={isThinking}
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
    />
  );
};

describe("LMTQueryAgentChatInput", () => {
  it("disables the send button when the query is empty", () => {
    render(<Harness />);
    expect((screen.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("enables and submits once a query is typed", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("Message input"), "show errors");
    const send = screen.getByRole("button", { name: "Send message" }) as HTMLButtonElement;
    expect(send.disabled).toBe(false);
    await user.click(send);
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });

  it("disables the input while the agent is thinking", () => {
    render(<Harness isThinking />);
    expect((screen.getByLabelText("Message input") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Send message" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("forwards key events to the provided handler", async () => {
    const onKeyDown = vi.fn();
    const user = userEvent.setup();
    render(<Harness onKeyDown={onKeyDown} />);
    await user.type(screen.getByLabelText("Message input"), "a");
    expect(onKeyDown).toHaveBeenCalled();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  streamQuery: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-ai/hooks/use-agent", () => ({
  useLMTQueryAgentSSE: () => ({ streamQuery: h.streamQuery }),
}));

// Replace the chat input with a minimal harness that submits a fixed query, so
// the test can focus on the agent's streaming/conversation behaviour.
vi.mock("./lmt-query-agent-chat-input", () => ({
  LMTQueryAgentChatInput: ({
    onSubmit,
  }: {
    onSubmit: (v: { query: string }) => void;
  }) => (
    <button type="button" onClick={() => onSubmit({ query: "How many users?" })}>
      send-query
    </button>
  ),
}));

import { LMTQueryAgent } from "./lmt-query-agent";

// Builds a fake SSE ReadableStream from raw text chunks.
const makeStream = (text: string) => {
  const chunks = [new TextEncoder().encode(text)];
  let i = 0;
  return {
    getReader: () => ({
      read: async () =>
        i < chunks.length
          ? { done: false, value: chunks[i++] }
          : { done: true, value: undefined },
    }),
  };
};

describe("LMTQueryAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the agent name and the empty conversation prompt", () => {
    render(<LMTQueryAgent agentName="LMT Assistant" questions={["What is X?"]} />);
    expect(screen.getByText("LMT Assistant")).toBeTruthy();
    expect(screen.getByText("What is X?")).toBeTruthy();
  });

  it("invokes onClose when the close button is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<LMTQueryAgent agentName="LMT Assistant" onClose={onClose} />);
    const closeButton = screen
      .getAllByRole("button")
      .find((b) => b.className.includes("rounded-full")) as HTMLButtonElement;
    await user.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("streams a query and renders the human message and the bot answer", async () => {
    h.streamQuery.mockResolvedValue(
      makeStream(
        'event: start\ndata: {"session_id":"s-1"}\n\n' +
          'event: final_answer\ndata: {"result":"There are 42 users.","next_step_questions":["Show breakdown?"]}\n\n' +
          "event: complete\ndata: {}\n\n",
      ),
    );
    const user = userEvent.setup();
    render(<LMTQueryAgent agentName="LMT Assistant" />);

    await user.click(screen.getByRole("button", { name: "send-query" }));

    await waitFor(() =>
      expect(h.streamQuery).toHaveBeenCalledWith({ query: "How many users?", session_id: null }),
    );
    expect(await screen.findByText("How many users?")).toBeTruthy();
    expect(await screen.findByText("There are 42 users.")).toBeTruthy();
    // The follow-up suggestion from the final answer is surfaced.
    expect(await screen.findByText("Show breakdown?")).toBeTruthy();
  });

  it("renders an error answer when an error event is streamed", async () => {
    h.streamQuery.mockResolvedValue(
      makeStream('event: error\ndata: {"error":"Backend exploded"}\n\nevent: complete\ndata: {}\n\n'),
    );
    const user = userEvent.setup();
    render(<LMTQueryAgent agentName="LMT Assistant" />);
    await user.click(screen.getByRole("button", { name: "send-query" }));
    expect(await screen.findByText("Backend exploded")).toBeTruthy();
  });

  it("shows a fallback message when the stream throws", async () => {
    h.streamQuery.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<LMTQueryAgent agentName="LMT Assistant" />);
    await user.click(screen.getByRole("button", { name: "send-query" }));
    expect(
      await screen.findByText("Something went wrong. Please try again later."),
    ).toBeTruthy();
  });
});

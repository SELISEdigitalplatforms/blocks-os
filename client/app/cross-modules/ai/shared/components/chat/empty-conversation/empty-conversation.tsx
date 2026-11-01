import { ChatItemSuggestions } from "../chat-item-suggestions/chat-item-suggestions";
import { tStatic } from "@seliseblocks/genesis-os";
export const EmptyConversations = ({
  queries = [],
  onSelect,
  title = "Hello! How can I assist you today?",
  description = tStatic("os.ai", "EMPTY_CONVERSATION.HERE_TO_ANSWER_QUESTIONS_UNCOVER"),
}: {
  queries?: string[];
  onSelect?: (question: string) => void;
  title?: string;
  description?: string;
}) => (
  <div className="flex h-full flex-col">
    <div className="flex flex-1 flex-col items-center justify-center">
      <h3 className="text-center text-lg font-semibold text-high-emphasis">{title}</h3>
      <p className="text-center text-medium-emphasis">{description}</p>
    </div>
    <div>
      <ChatItemSuggestions suggestions={queries} onSelect={onSelect} />
    </div>
  </div>
);

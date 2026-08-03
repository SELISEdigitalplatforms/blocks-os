import React, { useEffect, useState } from "react";

interface ChatEventMessageProps {
  message: string;
}

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const eventTypes = [
//   "workflow_start",
//   "node_start",
//   "planner_decision_task",
//   "retrieval_start",
//   "retrieval_complete",
//   "tool_execution_start",
//   "tool_execution_approval_required",
//   "tool_execution_complete",
//   "subagent_call_start",
//   "subagent_call_complete",
//   "execution_long_running",
//   "partial_failure",
//   "execution_failed",
// ];

const EVENT_MESSAGES: Record<string, string[]> = {
  workflow_start: [
    "Got it — working on this now",
    "Alright, let me take a look",
    "On it",
    "Starting to process your request",
    "Let's get this going",
    "I'm handling this now",
    "Understood — beginning",
    "I've started working on this",
    "Give me a moment",
    "Taking this on now",
  ],
  node_start: [
    "Thinking this through",
    "Analyzing your request",
    "Let me understand what you need",
    "Figuring out the best approach",
    "Breaking this down",
    "Planning next steps",
    "Assessing the situation",
    "Understanding the context",
    "Making sense of your request",
    "Determining how to proceed",
  ],
  planner_decision_task: [
    "This will require a few steps",
    "I'll need to gather some information",
    "This involves doing some work behind the scenes",
    "I need to run a few actions for this",
    "This isn't just a quick reply — working on it",
    "I'll take care of this step by step",
    "Some processing is needed here",
    "I'm moving into execution mode",
    "This requires fetching and processing data",
    "Let me handle this properly",
  ],
  retrieval_start: [
    "Looking for relevant information",
    "Searching through available sources",
    "Scanning documents for useful details",
    "Finding the information needed",
    "Pulling in related context",
    "Exploring knowledge sources",
    "Checking what data is available",
    "Gathering reference material",
    "Digging into the documents",
    "Retrieving helpful context",
  ],
  retrieval_complete: [
    "Found relevant information",
    "I've gathered what I need",
    "Search complete — reviewing results",
    "Information retrieved successfully",
    "I've pulled in the necessary context",
    "Sources found — analyzing now",
    "Relevant data is ready",
    "I've got the information",
    "Finished searching",
    "Results are in",
  ],
  tool_execution_start: [
    "Running an external action",
    "Executing a required operation",
    "Calling an external service",
    "Performing an automated action",
    "Triggering a tool",
    "Processing this action",
    "Working through an external step",
    "Executing the necessary command",
    "Running the required operation",
    "Handling an external task",
  ],
  tool_execution_approval_required: [
    "I need your approval to continue",
    "This action requires your confirmation",
    "Please review and approve this step",
    "Waiting for your permission",
    "Your approval is required to proceed",
    "Can you confirm before I continue?",
    "I need the go-ahead from you",
    "Approval needed to move forward",
    "Please approve this action",
    "This step needs your confirmation",
  ],
  tool_execution_complete: [
    "Action completed successfully",
    "The operation is done",
    "That step has finished",
    "Tool execution complete",
    "External action completed",
    "Finished running the tool",
    "The operation has concluded",
    "That action is now complete",
    "Tool finished successfully",
    "Execution finished",
  ],
  subagent_call_start: [
    "Consulting a specialist",
    "Asking another system for help",
    "Reaching out to a supporting agent",
    "Delegating part of this task",
    "Getting input from another agent",
    "Handing this off briefly",
    "Calling a helper agent",
    "Requesting additional expertise",
    "Consulting a secondary system",
    "Gathering input from elsewhere",
  ],
  subagent_call_complete: [
    "Got the additional input",
    "Received feedback from the other agent",
    "The supporting agent has responded",
    "Input received — continuing",
    "I've got the response",
    "Sub-agent task completed",
    "Additional information received",
    "Response received successfully",
    "The helper agent has replied",
    "Input gathered",
  ],
  execution_long_running: [
    "This is taking a bit longer than expected",
    "Still working — thanks for your patience",
    "Almost there, just a moment",
    "This step needs a little more time",
    "Hang tight, I'm still working",
    "Processing is ongoing",
    "This is a heavier task — continuing",
    "Still running in the background",
    "I'm making progress, just slower than usual",
    "Appreciate your patience — still working",
  ],
  partial_failure: [
    "Some steps didn't work, but I can still help",
    "I ran into an issue, but here's what I found",
    "Part of this failed — continuing with available results",
    "Not everything worked, but I've got something useful",
    "There were a few issues — here's what I can provide",
    "Some actions failed, others succeeded",
    "I encountered a problem, but recovered",
    "Partial success — continuing",
    "A few steps failed along the way",
    "There were hiccups, but I can still answer",
  ],
  execution_failed: [
    "I wasn't able to complete this request",
    "Something went wrong during processing",
    "This task couldn't be completed",
    "I ran into an error and couldn't continue",
    "Execution failed unexpectedly",
    "I couldn't finish this task",
    "An error stopped the process",
    "This request failed to complete",
    "I wasn't able to carry this out",
    "The operation did not succeed",
  ],
  workflow_end: [
    "All done",
    "Here's what I found",
    "I've finished processing your request",
    "That's everything",
    "Here's the result",
    "I'm done — take a look",
    "Processing complete",
    "This is the final result",
    "I've wrapped this up",
    "Ready with the answer",
  ],
};

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const getRandomEventMessage = (eventType: string): string => {
//   let normalizedType = eventType.toLowerCase().replace(/-/g, "_");
////   if (normalizedType.startsWith("node_start")) {
//     normalizedType = "node_start";
//   }
////   const messages = EVENT_MESSAGES[normalizedType];
//   if (!messages || messages.length === 0) {
//     return "Processing";
//   }
////   return messages[Math.floor(Math.random() * messages.length)];
// };

export const AnimatedDots = () => {
  return (
    <div className="flex items-center gap-1">
      <span
        className="h-2 w-2 rounded-full"
        style={{
          animation: "typing 1.4s infinite",
          animationDelay: "0ms",
          background: "#9ca3af",
        }}
      />
      <span
        className="h-2 w-2 rounded-full"
        style={{
          animation: "typing 1.4s infinite",
          animationDelay: "200ms",
          background: "#9ca3af",
        }}
      />
      <span
        className="h-2 w-2 rounded-full"
        style={{
          animation: "typing 1.4s infinite",
          animationDelay: "400ms",
          background: "#9ca3af",
        }}
      />
      <style>{`
        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            background: #9ca3af;
          }
          30% {
            transform: translateY(-4px);
            background: #124091;
          }
        }
      `}</style>
    </div>
  );
};

export const ChatEventMessage: React.FC<ChatEventMessageProps> = ({ message }) => {
  const [key, setKey] = useState(0);

  useEffect(() => {
    setKey((prev) => prev + 1);
  }, [message]);

  return (
    <div
      key={key}
      className="flex items-center gap-2 duration-500 animate-in fade-in slide-in-from-left-2"
    >
      <p className="text-sm italic text-medium-emphasis">{message}</p>
      <AnimatedDots />
    </div>
  );
};

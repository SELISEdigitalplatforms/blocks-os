import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";

type Narration = { title: string; description: string };
type Attributes = FlowStep["span"]["attributes"];

const cacheOutcome = (hit: unknown) => {
  if (hit === "true" || hit === 1) return "Hit";
  if (hit === "false" || hit === 0) return "Miss";
  return undefined;
};

const writeAction = (operation: string) => {
  if (/insert|create/i.test(operation)) return "add";
  if (/delete|remove/i.test(operation)) return "remove";
  if (/update|replace/i.test(operation)) return "update";
  return null;
};

const describeDatabase = (
  operation: string,
  attrs: Attributes,
  from: string,
  to: string,
): Narration => {
  const collection =
    attrs["db.collection.name"] || attrs["db.mongodb.collection"] || attrs["db.namespace"];
  const location = collection ? ` in the ${collection} collection` : "";
  if (/find|read|select|query|get|count|aggregate/i.test(operation)) {
    return {
      title: "Looking up the data",
      description: `${from} looks up data${location} using ${to}.`,
    };
  }
  const action = writeAction(operation);
  let description: string;
  if (action) {
    const preposition = action === "remove" ? "from" : "in";
    const destination = collection ? ` ${preposition} the ${collection} collection` : "";
    description = `${from} asks ${to} to ${action} data${destination}.`;
  } else {
    const target = collection ? ` on the ${collection} collection` : "";
    description = `${from} asks ${to} to run ${operation}${target}.`;
  }
  return { title: "Updating the data", description };
};

const describeCache = (
  operation: string,
  attrs: Attributes,
  from: string,
  to: string,
): Narration => {
  const reading = /get|read|exists/i.test(operation);
  const action = reading ? "looks for cached data" : "sends an update";
  let outcome = "";
  const hit = cacheOutcome(attrs["cache.hit"]);
  if (hit === "Hit") outcome = " The trace records a cache hit.";
  if (hit === "Miss") outcome = " The trace records a cache miss.";
  return {
    title: reading ? "Checking the cache" : "Updating the cache",
    description: `${from} ${action} in ${to}.${outcome}`,
  };
};

const describeMessage = (step: FlowStep, from: string, to: string): Narration => {
  if (step.span.kind?.toLowerCase() === "consumer") {
    return { title: "A worker picks it up", description: `${to} receives a message from ${from}.` };
  }
  return { title: "Passing the work along", description: `${from} publishes a message to ${to}.` };
};

const describeAction = (step: FlowStep, from: string, to: string): Narration => {
  if (step.fromId === "caller")
    return { title: "The request arrives", description: `${to} receives ${step.tag}.` };
  const operation = step.operationName.replace(/^(MongoDb|Redis)::/i, "");
  const attrs = step.span.attributes ?? {};
  switch (step.traffic) {
    case "data":
      return describeDatabase(operation, attrs, from, to);
    case "cache":
      return describeCache(operation, attrs, from, to);
    case "message":
      return describeMessage(step, from, to);
  }
  if (step.fromId === step.toId)
    return {
      title: "Working inside the service",
      description: `${to} runs ${step.operationName}.`,
    };
  return { title: "Calling the next service", description: `${from} calls ${to} · ${step.tag}.` };
};

const describeCacheEvent = (step: FlowStep, from: string, to: string): Narration => {
  const operation = step.operationName.replace(/^(MongoDb|Redis)::/i, "");
  const failure = step.state === "error" ? " This span records an error." : "";
  return {
    title: step.isErrorOrigin ? "This is where it failed" : "Receiving a cache event",
    description: `${to} receives ${operation} from ${from}.${failure}`,
  };
};

export const describeTransfer = (step: FlowStep, from: string, to: string) => {
  // Cache consumers retain their event-specific wording, including their reported failure.
  if (
    step.fromId !== "caller" &&
    step.traffic === "cache" &&
    step.span.kind?.toLowerCase() === "consumer"
  ) {
    return { ...describeCacheEvent(step, from, to), ...recordedResult(step) };
  }
  const narration = describeAction(step, from, to);
  if (step.isErrorOrigin) {
    narration.title = "This is where it failed";
    narration.description += " This span records an error.";
  } else if (step.state === "error") {
    narration.description += " This span also reports a failure.";
  }
  return { ...narration, ...recordedResult(step) };
};

const outcomes: Record<FlowStep["state"], string> = {
  error: "The operation reported a failure.",
  warning: "The operation reported a warning.",
  ok: "The operation reported success.",
  unknown: "A completion outcome was not recorded.",
};

const recordedFacts = (attrs: Attributes) => {
  const facts: { label: string; value: string }[] = [];
  const collection =
    attrs["db.collection.name"] || attrs["db.mongodb.collection"] || attrs["db.namespace"];
  if (collection) facts.push({ label: "Collection", value: String(collection) });
  const count = attrs["result.count"];
  if (count !== undefined && count !== "")
    facts.push({ label: "Recorded count", value: String(count) });
  const hit = cacheOutcome(attrs["cache.hit"]);
  if (hit) facts.push({ label: "Cache", value: hit });
  const message = attrs["messaging.message_type"];
  if (message) facts.push({ label: "Message", value: String(message) });
  const response = attrs["http.response.status_code"] ?? attrs["response.status.code"];
  if (response !== undefined) facts.push({ label: "Response", value: String(response) });
  return facts.slice(0, 3);
};

export const recordedResult = (step: FlowStep) => ({
  outcome: outcomes[step.state],
  facts: recordedFacts(step.span.attributes ?? {}),
});

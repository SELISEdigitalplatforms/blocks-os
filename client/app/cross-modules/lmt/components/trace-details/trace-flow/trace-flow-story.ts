import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";

export const describeTransfer = (step: FlowStep, from: string, to: string) => {
  const attrs = step.span.attributes ?? {};
  const operation = step.operationName.replace(/^(MongoDb|Redis)::/i, "");
  const collection =
    attrs["db.collection.name"] || attrs["db.mongodb.collection"] || attrs["db.namespace"];
  let title: string;
  let description: string;
  if (step.fromId === "caller") {
    title = "The request arrives";
    description = `${to} receives ${step.tag}.`;
  } else if (step.traffic === "data") {
    const reading = /find|read|select|query|get|count|aggregate/i.test(operation);
    title = reading ? "Looking up the data" : "Updating the data";
    const writing = /insert|create/i.test(operation)
      ? "add"
      : /delete|remove/i.test(operation)
        ? "remove"
        : /update|replace/i.test(operation)
          ? "update"
          : null;
    description = reading
      ? `${from} looks up data${collection ? ` in the ${collection} collection` : ""} using ${to}.`
      : writing
        ? `${from} asks ${to} to ${writing} data${collection ? ` ${writing === "remove" ? "from" : "in"} the ${collection} collection` : ""}.`
        : `${from} asks ${to} to run ${operation}${collection ? ` on the ${collection} collection` : ""}.`;
  } else if (step.traffic === "cache") {
    if (step.span.kind?.toLowerCase() === "consumer") {
      return {
        title: step.isErrorOrigin ? "This is where it failed" : "Receiving a cache event",
        description: `${to} receives ${operation} from ${from}.${step.state === "error" ? " This span records an error." : ""}`,
        ...recordedResult(step),
      };
    }
    const reading = /get|read|exists/i.test(operation);
    title = reading ? "Checking the cache" : "Updating the cache";
    const hit = attrs["cache.hit"];
    description = `${from} ${reading ? "looks for cached data" : "sends an update"} in ${to}.${hit === "true" || hit === 1 ? " The trace records a cache hit." : hit === "false" || hit === 0 ? " The trace records a cache miss." : ""}`;
  } else if (step.traffic === "message") {
    const consumer = step.span.kind?.toLowerCase() === "consumer";
    title = consumer ? "A worker picks it up" : "Passing the work along";
    description = consumer
      ? `${to} receives a message from ${from}.`
      : `${from} publishes a message to ${to}.`;
  } else if (step.fromId === step.toId) {
    title = "Working inside the service";
    description = `${to} runs ${step.operationName}.`;
  } else {
    title = "Calling the next service";
    description = `${from} calls ${to} · ${step.tag}.`;
  }
  if (step.isErrorOrigin) {
    title = "This is where it failed";
    description += " This span records an error.";
  } else if (step.state === "error") {
    description += " This span also reports a failure.";
  }
  return { title, description, ...recordedResult(step) };
};

export const recordedResult = (step: FlowStep) => {
  const attrs = step.span.attributes ?? {};
  const facts: { label: string; value: string }[] = [];
  const collection =
    attrs["db.collection.name"] || attrs["db.mongodb.collection"] || attrs["db.namespace"];
  if (collection) facts.push({ label: "Collection", value: String(collection) });
  const count = attrs["result.count"];
  if (count !== undefined && count !== "")
    facts.push({ label: "Recorded count", value: String(count) });
  const hit = attrs["cache.hit"];
  if (hit === "true" || hit === 1) facts.push({ label: "Cache", value: "Hit" });
  if (hit === "false" || hit === 0) facts.push({ label: "Cache", value: "Miss" });
  const message = attrs["messaging.message_type"];
  if (message) facts.push({ label: "Message", value: String(message) });
  const response = attrs["http.response.status_code"] ?? attrs["response.status.code"];
  if (response !== undefined) facts.push({ label: "Response", value: String(response) });
  const outcome =
    step.state === "error"
      ? "The operation reported a failure."
      : step.state === "warning"
        ? "The operation reported a warning."
        : step.state === "ok"
          ? "The operation reported success."
          : "A completion outcome was not recorded.";
  return { outcome, facts: facts.slice(0, 3) };
};

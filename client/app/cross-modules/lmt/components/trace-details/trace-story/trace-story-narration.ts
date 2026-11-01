import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.lmt";

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
      title: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.LOOKING_UP_THE_DATA"),
      description: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.LOOKS_UP_DATA_USING", {
        from,
        location,
        to,
      }),
    };
  }
  const action = writeAction(operation);
  let description: string;
  if (action) {
    const preposition = action === "remove" ? "from" : "in";
    const destination = collection ? ` ${preposition} the ${collection} collection` : "";
    description = tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.ASKS_TO_DATA", {
      from,
      to,
      action,
      destination,
    });
  } else {
    const target = collection ? ` on the ${collection} collection` : "";
    description = tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.ASKS_TO_RUN", {
      from,
      to,
      operation,
      target,
    });
  }
  return { title: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.UPDATING_THE_DATA"), description };
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
    title: reading
      ? tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.CHECKING_THE_CACHE")
      : tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.UPDATING_THE_CACHE"),
    description: `${from} ${action} in ${to}.${outcome}`,
  };
};

const describeMessage = (step: FlowStep, from: string, to: string): Narration => {
  if (step.span.kind?.toLowerCase() === "consumer") {
    return {
      title: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.A_WORKER_PICKS_IT_UP"),
      description: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.RECEIVES_A_MESSAGE_FROM", {
        to,
        from,
      }),
    };
  }
  return {
    title: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.PASSING_THE_WORK_ALONG"),
    description: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.PUBLISHES_A_MESSAGE_TO", { from, to }),
  };
};

const describeAction = (step: FlowStep, from: string, to: string): Narration => {
  if (step.fromId === "caller")
    return {
      title: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.THE_REQUEST_ARRIVES"),
      description: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.RECEIVES", { to, tag: step.tag }),
    };
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
      title: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.WORKING_INSIDE_THE_SERVICE"),
      description: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.RUNS", {
        to,
        operationName: step.operationName,
      }),
    };
  return {
    title: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.CALLING_THE_NEXT_SERVICE"),
    description: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.CALLS", { from, to, tag: step.tag }),
  };
};

const describeCacheEvent = (step: FlowStep, from: string, to: string): Narration => {
  const operation = step.operationName.replace(/^(MongoDb|Redis)::/i, "");
  const failure = step.state === "error" ? " This span records an error." : "";
  return {
    title: step.isErrorOrigin
      ? tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.THIS_IS_WHERE_IT_FAILED")
      : tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.RECEIVING_A_CACHE_EVENT"),
    description: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.RECEIVES_FROM", {
      to,
      operation,
      from,
      failure,
    }),
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
    narration.title = tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.THIS_IS_WHERE_IT_FAILED");
    narration.description += " This span records an error.";
  } else if (step.state === "error") {
    narration.description += " This span also reports a failure.";
  }
  return { ...narration, ...recordedResult(step) };
};

const OUTCOME_KEYS: Record<FlowStep["state"], string> = {
  error: "TRACE_STORY_NARRATION.OUTCOME_ERROR",
  warning: "TRACE_STORY_NARRATION.OUTCOME_WARNING",
  ok: "TRACE_STORY_NARRATION.OUTCOME_OK",
  unknown: "TRACE_STORY_NARRATION.OUTCOME_UNKNOWN",
};

const recordedFacts = (attrs: Attributes) => {
  const facts: { label: string; value: string }[] = [];
  const collection =
    attrs["db.collection.name"] || attrs["db.mongodb.collection"] || attrs["db.namespace"];
  if (collection)
    facts.push({
      label: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.COLLECTION"),
      value: String(collection),
    });
  const count = attrs["result.count"];
  if (count !== undefined && count !== "")
    facts.push({
      label: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.RECORDED_COUNT"),
      value: String(count),
    });
  const hit = cacheOutcome(attrs["cache.hit"]);
  if (hit) facts.push({ label: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.CACHE"), value: hit });
  const message = attrs["messaging.message_type"];
  if (message)
    facts.push({
      label: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.MESSAGE"),
      value: String(message),
    });
  const response = attrs["http.response.status_code"] ?? attrs["response.status.code"];
  if (response !== undefined)
    facts.push({
      label: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.RESPONSE"),
      value: String(response),
    });
  return facts.slice(0, 3);
};

export const recordedResult = (step: FlowStep) => ({
  outcome: tStatic(I18N_MODULE, OUTCOME_KEYS[step.state]),
  facts: recordedFacts(step.span.attributes ?? {}),
});

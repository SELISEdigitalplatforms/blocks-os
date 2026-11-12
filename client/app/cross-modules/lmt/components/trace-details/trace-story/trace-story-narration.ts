import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.lmt";

type Narration = { title: string; description: string };
type Attributes = FlowStep["span"]["attributes"];

type CacheOutcome = "hit" | "miss";

const cacheOutcome = (hit: unknown): CacheOutcome | undefined => {
  if (hit === "true" || hit === 1) return "hit";
  if (hit === "false" || hit === 0) return "miss";
  return undefined;
};

const CACHE_OUTCOME_VALUE_KEYS: Record<CacheOutcome, string> = {
  hit: "TRACE_STORY_NARRATION.HIT",
  miss: "TRACE_STORY_NARRATION.MISS",
};

type WriteAction = "add" | "remove" | "update";

const writeAction = (operation: string): WriteAction | null => {
  if (/insert|create/i.test(operation)) return "add";
  if (/delete|remove/i.test(operation)) return "remove";
  if (/update|replace/i.test(operation)) return "update";
  return null;
};

const WRITE_KEYS: Record<WriteAction, { plain: string; inCollection: string }> = {
  add: {
    plain: "TRACE_STORY_NARRATION.ASKS_TO_ADD_DATA",
    inCollection: "TRACE_STORY_NARRATION.ASKS_TO_ADD_DATA_IN_COLLECTION",
  },
  remove: {
    plain: "TRACE_STORY_NARRATION.ASKS_TO_REMOVE_DATA",
    inCollection: "TRACE_STORY_NARRATION.ASKS_TO_REMOVE_DATA_FROM_COLLECTION",
  },
  update: {
    plain: "TRACE_STORY_NARRATION.ASKS_TO_UPDATE_DATA",
    inCollection: "TRACE_STORY_NARRATION.ASKS_TO_UPDATE_DATA_IN_COLLECTION",
  },
};

const describeRead = (from: string, to: string, collection: unknown) =>
  collection
    ? tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.LOOKS_UP_DATA_IN_COLLECTION_USING", {
        from,
        collection: String(collection),
        to,
      })
    : tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.LOOKS_UP_DATA_USING", {
        from,
        location: "",
        to,
      });

const describeWrite = (action: WriteAction, from: string, to: string, collection: unknown) =>
  collection
    ? tStatic(I18N_MODULE, WRITE_KEYS[action].inCollection, {
        from,
        to,
        collection: String(collection),
      })
    : tStatic(I18N_MODULE, WRITE_KEYS[action].plain, { from, to });

const describeRun = (operation: string, from: string, to: string, collection: unknown) =>
  collection
    ? tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.ASKS_TO_RUN_ON_COLLECTION", {
        from,
        to,
        operation,
        collection: String(collection),
      })
    : tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.ASKS_TO_RUN", {
        from,
        to,
        operation,
        target: "",
      });

const describeDatabase = (
  operation: string,
  attrs: Attributes,
  from: string,
  to: string,
): Narration => {
  const collection =
    attrs["db.collection.name"] || attrs["db.mongodb.collection"] || attrs["db.namespace"];
  if (/find|read|select|query|get|count|aggregate/i.test(operation)) {
    return {
      title: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.LOOKING_UP_THE_DATA"),
      description: describeRead(from, to, collection),
    };
  }
  const action = writeAction(operation);
  const description = action
    ? describeWrite(action, from, to, collection)
    : describeRun(operation, from, to, collection);
  return { title: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.UPDATING_THE_DATA"), description };
};

const CACHE_OUTCOME_SENTENCE_KEYS: Record<CacheOutcome, string> = {
  hit: "TRACE_STORY_NARRATION.THE_TRACE_RECORDS_A_CACHE_HIT",
  miss: "TRACE_STORY_NARRATION.THE_TRACE_RECORDS_A_CACHE_MISS",
};

const describeCache = (
  operation: string,
  attrs: Attributes,
  from: string,
  to: string,
): Narration => {
  const reading = /get|read|exists/i.test(operation);
  const sentence = reading
    ? tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.LOOKS_FOR_CACHED_DATA_IN", { from, to })
    : tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.SENDS_AN_UPDATE_IN", { from, to });
  const hit = cacheOutcome(attrs["cache.hit"]);
  const outcome = hit ? ` ${tStatic(I18N_MODULE, CACHE_OUTCOME_SENTENCE_KEYS[hit])}` : "";
  return {
    title: reading
      ? tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.CHECKING_THE_CACHE")
      : tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.UPDATING_THE_CACHE"),
    description: `${sentence}${outcome}`,
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
  const failure =
    step.state === "error"
      ? ` ${tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.THIS_SPAN_RECORDS_AN_ERROR")}`
      : "";
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
    narration.description += ` ${tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.THIS_SPAN_RECORDS_AN_ERROR")}`;
  } else if (step.state === "error") {
    narration.description += ` ${tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.THIS_SPAN_ALSO_REPORTS_A_FAILURE")}`;
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
  if (hit)
    facts.push({
      label: tStatic(I18N_MODULE, "TRACE_STORY_NARRATION.CACHE"),
      value: tStatic(I18N_MODULE, CACHE_OUTCOME_VALUE_KEYS[hit]),
    });
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

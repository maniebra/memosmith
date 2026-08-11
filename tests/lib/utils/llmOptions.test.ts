const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  defaultLlmSettings,
  emptyLlmSettings,
  mergeLlm,
} from "../../../src/lib/storage/settings";
import { requestOptions } from "../../../src/lib/utils/llmOptions";

assert(
  Object.keys(requestOptions(defaultLlmSettings)).length === 0,
  "unset options are omitted",
);

const tuned = requestOptions({
  ...defaultLlmSettings,
  reasoningEffort: "high",
  temperature: "0",
  topP: "0.9",
  maxTokens: "512",
  presencePenalty: "-0.5",
  seed: "7",
  stop: "END, ###, ",
});

assert(tuned.reasoning_effort === "high", "reasoning effort is passed through");
assert(tuned.temperature === 0, "zero is a real value, not an empty field");
assert(tuned.top_p === 0.9 && tuned.max_tokens === 512, "numbers parse");
assert(
  tuned.presence_penalty === -0.5 && tuned.seed === 7,
  "negatives and ints parse",
);
assert(
  !("frequency_penalty" in tuned),
  "an untouched field stays out of the body",
);
assert(
  JSON.stringify(tuned.stop) === '["END","###"]',
  "stop splits on commas and drops blanks",
);

assert(
  !(
    "temperature" in
    requestOptions({ ...defaultLlmSettings, temperature: "hot" })
  ),
  "junk numbers are ignored",
);

const extra = requestOptions({
  ...defaultLlmSettings,
  temperature: "1",
  extraBody: '{"top_k": 40, "temperature": 2}',
});

assert(extra.top_k === 40, "extra body adds provider-specific knobs");
assert(extra.temperature === 2, "extra body wins over the fields it repeats");

for (const bad of ["{oops", "[1,2]", '"text"']) {
  let threw = false;

  try {
    requestOptions({ ...defaultLlmSettings, extraBody: bad });
  } catch {
    threw = true;
  }

  assert(threw, `extra body rejects ${bad}`);
}

const base = { ...defaultLlmSettings, model: "big", temperature: "1" };

assert(
  mergeLlm(base, emptyLlmSettings).model === "big",
  "a blank override inherits everything",
);

const overridden = mergeLlm(base, {
  ...emptyLlmSettings,
  model: "small",
  reasoningEffort: "high",
});

assert(overridden.model === "small", "filled fields win");
assert(
  overridden.temperature === "1",
  "untouched fields still come from the base",
);
assert(
  overridden.reasoningEffort === "high",
  "an override can add what the base left blank",
);
assert(
  mergeLlm(base, { ...emptyLlmSettings, model: "   " }).model === "big",
  "whitespace is not an override",
);

console.log("llmOptions ok");

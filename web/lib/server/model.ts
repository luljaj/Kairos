import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ModelRequest, ModelResponse, checkModelResponse } from "@/lib/contracts";

type Failure = "configuration" | "transport" | "http" | "refusal" | "truncation" | "json" | "schema" | "semantic";

export class ModelFailure extends Error {
  constructor(readonly category: Failure, readonly httpStatus?: number) {
    super(category);
  }
}

export type ModelConfig = {
  mode: "model" | "fallback" | "mock";
  provider: "compatible" | "openai";
  format: "json_schema" | "json_object" | "text";
  endpoint: string;
  name: string;
  key: string;
};

export function loadModelConfig(env: NodeJS.ProcessEnv): ModelConfig {
  const mode = env.MODEL_MODE ?? "mock";
  const provider = env.MODEL_PROVIDER ?? "compatible";
  const format = env.MODEL_RESPONSE_FORMAT ?? "json_schema";
  if ((mode !== "model" && mode !== "fallback" && mode !== "mock")
      || (provider !== "compatible" && provider !== "openai")
      || (format !== "json_schema" && format !== "json_object" && format !== "text")) {
    throw new ModelFailure("configuration");
  }
  const openAI = provider === "openai";
  const key = env.MODEL_API_KEY?.trim() ?? "";
  const name = env.MODEL_NAME?.trim() || (openAI ? "" : "Qwen/Qwen3-4B-Instruct-2507");
  if (openAI && (!key || !name || format !== "json_schema")) throw new ModelFailure("configuration");

  const base = env.MODEL_BASE_URL ?? (openAI ? "https://api.openai.com/v1" : "http://127.0.0.1:8000/v1");
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new ModelFailure("configuration");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new ModelFailure("configuration");
  }
  const endpoint = url.href.replace(/\/+$/, "") + "/chat/completions";
  return { mode, provider, format, endpoint, name, key };
}

// OpenAI Structured Outputs supports nested anyOf. The response variants have
// disjoint status literals, so using anyOf preserves the exported union.
const wrappedResponse = z.strictObject({ result: ModelResponse });
const fineTuneUnsupported = new Set(["minLength", "maxLength", "minItems", "maxItems"]);

function openAISchema() {
  const schema = z.toJSONSchema(wrappedResponse, {
    target: "draft-7",
    override: ({ jsonSchema }) => {
      for (const key of fineTuneUnsupported) delete jsonSchema[key];
      if (jsonSchema.oneOf) {
        jsonSchema.anyOf = jsonSchema.oneOf;
        delete jsonSchema.oneOf;
      }
      if (jsonSchema.const !== undefined) {
        jsonSchema.enum = [jsonSchema.const];
        delete jsonSchema.const;
      }
    },
  });
  delete schema.$schema;
  return schema;
}

const envelope = z.object({
  model: z.string().min(1).optional(),
  choices: z.array(z.object({
    finish_reason: z.string(),
    message: z.object({ refusal: z.unknown().optional(), content: z.unknown().optional() }),
  })).min(1),
});

export function validateModelResponse(request: ModelRequest, value: unknown): ModelResponse {
  const parsed = ModelResponse.safeParse(value);
  if (!parsed.success) throw new ModelFailure("schema");
  if (checkModelResponse(request, parsed.data).length) throw new ModelFailure("semantic");
  return parsed.data;
}

export type Inference = (request: ModelRequest, signal: AbortSignal) => Promise<{
  response: ModelResponse;
  modelId: string;
  latencyMs: number;
}>;

export function createModelClient(
  config: ModelConfig,
  { fetcher = fetch, clock = () => performance.now(), modelDir = path.resolve("..", "model") } = {},
): { infer: Inference; promptHash: string | null } {
  if (config.mode !== "model") {
    return { infer: async () => { throw new ModelFailure("configuration"); }, promptHash: null };
  }

  const openAI = config.provider === "openai";
  let prompt: string;
  let format: Record<string, unknown> | undefined;
  try {
    prompt = readFileSync(path.join(modelDir, "prompt.md"), "utf8").trim();
    if (!prompt) throw new ModelFailure("configuration");
    if (config.format === "json_schema") {
      const schema = openAI ? openAISchema() : JSON.parse(
        readFileSync(path.join(modelDir, "schemas", "model-response.json"), "utf8"),
        (key, value: unknown) => key === "uniqueItems" ? undefined : value,
      );
      format = {
        type: "json_schema",
        json_schema: { name: "ModelResponse", ...(openAI ? { strict: true } : {}), schema },
      };
    } else if (config.format === "json_object") {
      format = { type: "json_object" };
    }
  } catch {
    throw new ModelFailure("configuration");
  }

  const promptHash = createHash("sha256").update(prompt).digest("hex");
  const system = openAI ? prompt + '\n\nPut the complete response object inside the top-level "result" key.' : prompt;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.key) headers.Authorization = `Bearer ${config.key}`;

  return {
    promptHash,
    async infer(request, signal) {
      const parsedRequest = ModelRequest.safeParse(request);
      if (!parsedRequest.success) throw new ModelFailure("schema");
      const body = {
        model: config.name,
        ...(openAI ? { max_completion_tokens: 2048 } : { temperature: 0, max_tokens: 600 }),
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(parsedRequest.data) },
        ],
        ...(format ? { response_format: format } : {}),
      };
      const started = clock();
      let response: Response;
      try {
        response = await fetcher(config.endpoint, {
          method: "POST", headers, body: JSON.stringify(body), signal, cache: "no-store", redirect: "error",
        });
      } catch {
        throw new ModelFailure("transport");
      }
      if (!response.ok) throw new ModelFailure("http", response.status);

      let raw: unknown;
      try {
        raw = await response.json();
      } catch {
        throw new ModelFailure("json");
      }
      const parsed = envelope.safeParse(raw);
      if (!parsed.success) throw new ModelFailure("schema");
      const choice = parsed.data.choices[0];
      const { refusal, content } = choice.message;
      if (refusal !== undefined && refusal !== null && refusal !== "") throw new ModelFailure("refusal");
      if (choice.finish_reason !== "stop") throw new ModelFailure("truncation");
      if (typeof content !== "string") throw new ModelFailure("schema");

      let payload: unknown;
      try {
        payload = JSON.parse(content);
      } catch {
        throw new ModelFailure("json");
      }
      if (openAI) {
        const wrapped = z.strictObject({ result: z.unknown() }).safeParse(payload);
        if (!wrapped.success) throw new ModelFailure("schema");
        payload = wrapped.data.result;
      }
      return { response: validateModelResponse(parsedRequest.data, payload), modelId: parsed.data.model ?? config.name, latencyMs: clock() - started };
    },
  };
}

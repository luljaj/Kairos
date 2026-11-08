/**
 * Writes JSON Schema for the model request/response from the zod contracts to
 * lib/contracts/json/ (gitignored) so it can be diffed against the hand-written
 * model/schemas/*.json. It does not overwrite model/ (agent-owned).
 * Run: pnpm contracts:export
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ModelRequest, ModelResponse } from "@/lib/contracts";

const outDir = path.resolve(__dirname, "..", "lib", "contracts", "json");
fs.mkdirSync(outDir, { recursive: true });
for (const [name, schema] of [
  ["model-request.json", ModelRequest],
  ["model-response.json", ModelResponse],
] as const) {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" });
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(json, null, 2) + "\n");
  console.log(`wrote ${path.relative(process.cwd(), path.join(outDir, name))}`);
}

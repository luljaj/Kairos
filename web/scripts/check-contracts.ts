/**
 * Verifies the zod contracts agree with the Python side:
 *  - every model/schemas/examples/*.json parses with ModelRequest / ModelResponse,
 *  - every request in model/fixtures/demo/demo.jsonl parses (if present),
 *  - web/fixtures parse (fleet + scenarios).
 * Run: pnpm contracts:check
 */
import fs from "node:fs";
import path from "node:path";
import { checkModelResponse, ModelRequest, ModelResponse, type ModelRequest as Req } from "@/lib/contracts";
import { fleetFixture, scenarios } from "@/lib/server/fixtures";

const root = path.resolve(__dirname, "..", "..");
const examplesDir = path.join(root, "model", "schemas", "examples");
let failures = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok   ${label}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${label}\n       ${err instanceof Error ? err.message.split("\n").slice(0, 6).join("\n       ") : err}`);
  }
}

console.log("model/schemas/examples");
const requests: Record<string, Req> = {};
for (const file of fs.readdirSync(examplesDir).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(examplesDir, file), "utf8"));
  if (file.startsWith("request.")) check(file, () => void (requests[file.slice(8)] = ModelRequest.parse(data)));
  else if (file.startsWith("response.")) {
    check(file, () => {
      const res = ModelResponse.parse(data);
      const req = requests[file.slice(9)];
      if (req) {
        const problems = checkModelResponse(req, res);
        if (problems.length) throw new Error(problems.join("; "));
      }
    });
  }
}

const demo = path.join(root, "model", "fixtures", "demo", "demo.jsonl");
if (fs.existsSync(demo)) {
  console.log("model/fixtures/demo/demo.jsonl");
  const lines = fs.readFileSync(demo, "utf8").split("\n").filter(Boolean);
  let ok = 0;
  lines.forEach((line, i) => {
    const row = JSON.parse(line);
    const user = row.messages?.find((m: { role: string }) => m.role === "user");
    const asst = row.messages?.find((m: { role: string }) => m.role === "assistant");
    try {
      const req = ModelRequest.parse(JSON.parse(user.content));
      if (asst) {
        const res = ModelResponse.parse(JSON.parse(asst.content));
        const problems = checkModelResponse(req, res);
        if (problems.length) throw new Error(problems.join("; "));
      }
      ok++;
    } catch (err) {
      failures++;
      console.log(`  FAIL line ${i + 1}: ${err instanceof Error ? err.message.slice(0, 300) : err}`);
    }
  });
  console.log(`  ${ok}/${lines.length} rows ok`);
}

console.log("web/fixtures");
check(`fleet.json (${fleetFixture.ambulances.length} ambulances)`, () => {});
check(`scenarios (${Object.keys(scenarios).join(", ")})`, () => {});

if (failures) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall contracts agree");

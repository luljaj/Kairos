/**
 * Fake voice agent: places a call through the MCP endpoint, exactly like ElevenLabs will.
 * Sends the address, then the complaint, then the remaining facts (one tool call each, a beat
 * apart), then polls get_assignment until a dispatcher accepts on the dashboard.
 *
 *   pnpm call --address "45 Main St, Binghamton" --complaint "chest pain and sweating" --age 60 --conscious --breathing
 *   pnpm call --address "Bartle Library" --complaint "fell down the stairs, not answering" --conscious=false
 *
 * Flags: --url (default $KAIROS_URL or http://localhost:3000), --gap seconds between updates (default 2), --no-wait to skip polling.
 */
import { parseArgs } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

try {
  process.loadEnvFile(".env.local");
} catch {}

const { values: v } = parseArgs({
  options: {
    address: { type: "string" },
    complaint: { type: "string" },
    age: { type: "string" },
    sex: { type: "string" },
    conscious: { type: "string" },
    breathing: { type: "string" },
    "chest-pain": { type: "string" },
    bleeding: { type: "string" },
    mechanism: { type: "string" },
    relation: { type: "string" },
    notes: { type: "string" },
    caller: { type: "string", default: "+16075550123" },
    url: { type: "string", default: process.env.KAIROS_URL ?? "http://localhost:3000" },
    gap: { type: "string", default: "2" },
    "no-wait": { type: "boolean", default: false },
  },
  // `--conscious` alone means true; `--conscious=false` means false.
  args: process.argv.slice(2).map((a) =>
    /^--(conscious|breathing|chest-pain|bleeding)$/.test(a) ? `${a}=true` : a,
  ),
});

if (!v.address || !v.complaint) {
  console.error('Usage: pnpm call --address "<where>" --complaint "<what happened>" [--age N --conscious --breathing ...]');
  process.exit(1);
}

const bool = (s?: string) => (s === undefined ? undefined : s !== "false");
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const gap = Number(v.gap);
const conversationId = `cli-${crypto.randomUUID().slice(0, 8)}`;

const rest = Object.fromEntries(
  Object.entries({
    patientAge: v.age === undefined ? undefined : Number(v.age),
    patientSex: v.sex,
    conscious: bool(v.conscious),
    breathingNormally: bool(v.breathing),
    chestPain: bool(v["chest-pain"]),
    severeBleeding: bool(v.bleeding),
    traumaMechanism: v.mechanism,
    callerRelation: v.relation,
    notes: v.notes,
  }).filter(([, value]) => value !== undefined),
);

const client = new Client({ name: "kairos-cli-caller", version: "0.1.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL("/api/mcp", v.url)),
);

async function tool(name: string, args: Record<string, unknown>) {
  const started = Date.now();
  const result = await client.callTool({ name, arguments: { conversationId, ...args } });
  const text = (result.content as { type: string; text?: string }[])[0]?.text ?? "";
  if (result.isError) throw new Error(`${name}: ${text}`);
  return { data: JSON.parse(text), ms: Date.now() - started };
}

const steps: [string, Record<string, unknown>][] = [
  ["address", { callerNumber: v.caller, locationText: v.address }],
  ["complaint", { chiefComplaint: v.complaint }],
  ...(Object.keys(rest).length ? [["details", rest] as [string, Record<string, unknown>]] : []),
];
// The last update finishes intake, which lets the backend build the proposal.
steps[steps.length - 1][1].intakeComplete = true;

console.log(`☎  ${conversationId} → ${v.url}`);
for (const [i, [label, args]] of steps.entries()) {
  if (i > 0) await sleep(gap);
  const { data, ms } = await tool("update_incident", args);
  console.log(`  update_incident (${label}) ${ms}ms → ${data.callId}`, args);
}

if (!v["no-wait"]) {
  console.log("  waiting for the dispatcher to accept on the dashboard…");
  let lastHint = "";
  for (let i = 0; i < 60; i++) {
    const { data } = await tool("get_assignment", {});
    if (data.state === "assigned") {
      const eta = data.etaMinutes === null ? "no ETA yet" : `about ${data.etaMinutes} min`;
      console.log(`  ✓ ${data.unitName} is on the way, ${eta}${data.queued ? " (queued behind another call)" : ""}`);
      break;
    }
    const hint = `${data.sayHint}${data.missingFields.length ? ` — missing: ${data.missingFields.join(", ")}` : ""}`;
    if (hint !== lastHint) console.log(`  … ${hint}`);
    lastHint = hint;
    await sleep(3);
  }
}
await client.close();

/**
 * MCP endpoint (Streamable HTTP) for the ElevenLabs voice agent.
 * Stateless: a fresh server + transport per request; all state lives in the store.
 * No auth (demo): anyone with the tunnel URL can create calls.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createVoiceMcpServer } from "@/lib/server/mcp";

async function handle(req: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createVoiceMcpServer();
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // JSON responses are fully built by now; release the per-request server.
    void server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };

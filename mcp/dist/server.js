import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ProfileStore } from "./store.js";
import { requireAuth } from "./auth.js";
const store = new ProfileStore(process.env.PVAULT_STORE_DIR || "./data");
const server = new McpServer({ name: "profile-vault", version: "0.1.0" });
server.tool("profiles.list", "List stored profiles", {
    token: z.string().optional()
}, async ({ token }) => {
    requireAuth(token);
    const items = await store.list();
    return { content: [{ type: "text", text: JSON.stringify(items) }] };
});
server.tool("profiles.get", "Get a stored profile (zipBase64 + metadata)", {
    token: z.string().optional(),
    id: z.string()
}, async ({ token, id }) => {
    requireAuth(token);
    const p = await store.get(id);
    return { content: [{ type: "text", text: JSON.stringify(p) }] };
});
server.tool("profiles.put", "Store a profile zip (base64)", {
    token: z.string().optional(),
    name: z.string(),
    zipBase64: z.string(),
    manifestJson: z.any().optional()
}, async ({ token, name, zipBase64, manifestJson }) => {
    requireAuth(token);
    const id = await store.put(name, zipBase64, manifestJson);
    return { content: [{ type: "text", text: JSON.stringify({ id }) }] };
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});

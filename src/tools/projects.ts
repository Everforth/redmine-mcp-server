import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RedmineClient } from "../redmineClient.js";
import { ok, runTool } from "./runTool.js";

export function registerProjectTools(server: McpServer, client: RedmineClient): void {
  server.registerTool(
    "list_redmine_projects",
    {
      title: "List Redmine projects",
      description:
        "List Redmine projects accessible to the API key owner. Use limit/offset to page (default 25, max 100).",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("default 25, max 100"),
        offset: z.number().int().min(0).optional().describe("Pagination offset (0-based)"),
      },
    },
    async (args) =>
      runTool(async () => {
        const data = await client.get("projects.json", args);
        return ok(data);
      }),
  );

  server.registerTool(
    "get_redmine_project",
    {
      title: "Get a Redmine project",
      description: "Fetch a single Redmine project by numeric id or identifier slug.",
      inputSchema: {
        id: z
          .union([
            z.number().int().positive(),
            z.string().regex(/^[a-z0-9][a-z0-9_-]*$/).describe("project identifier slug"),
          ])
          .describe("Numeric id or identifier slug (e.g. 'my-project')"),
      },
    },
    async ({ id }) =>
      runTool(async () => {
        const data = await client.get(`projects/${id}.json`);
        return ok(data);
      }),
  );
}

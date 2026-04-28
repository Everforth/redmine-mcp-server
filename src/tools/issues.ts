import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RedmineClient } from "../redmineClient.js";
import { ok, runTool } from "./runTool.js";

export function registerIssueTools(server: McpServer, client: RedmineClient): void {
  server.registerTool(
    "get_redmine_issue",
    {
      title: "Get a Redmine issue",
      description: "Fetch a single Redmine issue by numeric id.",
      inputSchema: {
        id: z.number().int().positive().describe("Issue numeric id"),
        include: z
          .array(z.enum(["journals", "attachments"]))
          .optional()
          .describe(
            "Optional associations to fetch. journals = comment/change history. attachments = file list.",
          ),
      },
    },
    async ({ id, include }) =>
      runTool(async () => {
        const data = await client.get(`issues/${id}.json`, { include });
        return ok(data);
      }),
  );

  server.registerTool(
    "list_redmine_issues",
    {
      title: "List Redmine issues",
      description:
        "List Redmine issues with optional filters. By default Redmine returns OPEN issues only; pass status_id='*' for all, 'closed' for closed only, or a numeric status id. Typical use: pass project_id and page through with limit/offset.",
      inputSchema: {
        project_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Project numeric id (Redmine wiki: numeric value, not identifier slug)"),
        status_id: z
          .union([z.enum(["open", "closed", "*"]), z.number().int().positive()])
          .optional()
          .describe("'open' (default) | 'closed' | '*' for all | numeric status id"),
        assigned_to_id: z
          .union([z.literal("me"), z.number().int().positive()])
          .optional()
          .describe("User numeric id, or 'me' for the API key owner"),
        tracker_id: z.number().int().positive().optional().describe("Tracker numeric id"),
        sort: z
          .string()
          .regex(/^[a-z_]+(:desc)?(,[a-z_]+(:desc)?)*$/)
          .optional()
          .describe("Comma-separated columns, append :desc to invert. e.g. 'updated_on:desc'"),
        limit: z.number().int().min(1).max(100).optional().describe("default 25, max 100"),
        offset: z.number().int().min(0).optional().describe("Pagination offset (0-based)"),
      },
    },
    async (args) =>
      runTool(async () => {
        const data = await client.get("issues.json", args);
        return ok(data);
      }),
  );

  server.registerTool(
    "add_redmine_issue_comment",
    {
      title: "Add a comment to a Redmine issue",
      description:
        "Append a note (comment) to an existing Redmine issue without changing any other field. Status, assignee, priority, etc. cannot be modified through this tool.",
      inputSchema: {
        id: z.number().int().positive().describe("Issue numeric id"),
        notes: z
          .string()
          .min(1)
          .max(65535)
          .describe("Comment body (textile or markdown depending on Redmine setup)"),
        private_notes: z
          .boolean()
          .optional()
          .describe("If true, the note is visible only to users with permission"),
      },
    },
    async ({ id, notes, private_notes }) =>
      runTool(async () => {
        await client.put(`issues/${id}.json`, { issue: { notes, private_notes } });
        return ok({ added: true, id });
      }),
  );
}

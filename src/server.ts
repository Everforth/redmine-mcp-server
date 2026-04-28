#!/usr/bin/env node
// stdio is reserved for MCP JSON-RPC. Redirect any stray stdout writes to stderr.
console.log = console.error;

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RedmineClient } from "./redmineClient.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerProjectTools } from "./tools/projects.js";

const SERVER_NAME = "redmine-mcp-server";
const SERVER_VERSION = "0.1.0";

function readEnv(): { baseUrl: URL; apiKey: string } {
  const rawUrl = process.env.REDMINE_URL;
  const apiKey = process.env.REDMINE_API_KEY;
  if (!rawUrl || !apiKey) {
    console.error("REDMINE_URL/REDMINE_API_KEY is required.");
    process.exit(1);
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(rawUrl);
  } catch {
    console.error("REDMINE_URL is not a valid URL.");
    process.exit(1);
  }
  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    console.error("REDMINE_URL must be http(s).");
    process.exit(1);
  }
  return { baseUrl, apiKey };
}

async function main(): Promise<void> {
  const { baseUrl, apiKey } = readEnv();
  const client = new RedmineClient({ baseUrl, apiKey, version: SERVER_VERSION });

  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerIssueTools(server, client);
  registerProjectTools(server, client);

  const shutdown = async (signal: string) => {
    console.error(`${SERVER_NAME} received ${signal}, shutting down`);
    try {
      await server.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} ready; host=${client.hostForLog}`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`${SERVER_NAME} fatal: ${msg}`);
  process.exit(1);
});

import { RedmineError } from "../redmineClient.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export async function runTool(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: toUserMessage(err) }] };
  }
}

function toUserMessage(err: unknown): string {
  if (!(err instanceof RedmineError)) return "Unexpected error.";
  switch (err.kind) {
    case "auth":
      return "Redmine authentication failed.";
    case "forbidden":
      return "Permission denied for this Redmine resource.";
    case "not_found":
      return "Redmine resource not found.";
    case "validation": {
      const detail = err.errors?.length ? `: ${err.errors.join("; ")}` : "";
      return `Redmine validation error${detail}.`;
    }
    case "server":
      return `Redmine server error (status ${err.status ?? "unknown"}).`;
    case "network":
      return "Redmine request failed (network error).";
    case "timeout":
      return "Redmine request timed out.";
  }
}

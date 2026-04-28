export type RedmineErrorKind =
  | "auth"
  | "forbidden"
  | "not_found"
  | "validation"
  | "server"
  | "network"
  | "timeout";

export class RedmineError extends Error {
  readonly kind: RedmineErrorKind;
  readonly status?: number;
  readonly errors?: string[];

  constructor(kind: RedmineErrorKind, opts: { status?: number; errors?: string[] } = {}) {
    super(kind);
    this.name = "RedmineError";
    this.kind = kind;
    this.status = opts.status;
    this.errors = opts.errors;
  }
}

type Query = Record<string, string | number | boolean | string[] | number[] | undefined | null>;

export class RedmineClient {
  private readonly baseUrl: URL;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(opts: { baseUrl: URL; apiKey: string; version: string; timeoutMs?: number }) {
    this.baseUrl = opts.baseUrl;
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 30000;
    this.userAgent = `redmine-mcp-server/${opts.version}`;
  }

  get hostForLog(): string {
    return this.baseUrl.host;
  }

  async get(path: string, query?: Query): Promise<unknown> {
    return this.request("GET", path, query);
  }

  async put(path: string, body: unknown): Promise<unknown> {
    return this.request("PUT", path, undefined, body);
  }

  private async request(method: string, path: string, query?: Query, body?: unknown): Promise<unknown> {
    const url = new URL(path.replace(/^\//, ""), this.ensureTrailingSlash(this.baseUrl));
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
          if (v.length === 0) continue;
          url.searchParams.set(k, v.join(","));
        } else {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const headers: Record<string, string> = {
      "X-Redmine-API-Key": this.apiKey,
      Accept: "application/json",
      "User-Agent": this.userAgent,
    };
    let bodyText: string | undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      bodyText = JSON.stringify(body);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: bodyText,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        throw new RedmineError("timeout");
      }
      throw new RedmineError("network");
    }

    if (res.ok) {
      return this.parseJson(res);
    }

    if (res.status === 401) throw new RedmineError("auth", { status: 401 });
    if (res.status === 403) throw new RedmineError("forbidden", { status: 403 });
    if (res.status === 404) throw new RedmineError("not_found", { status: 404 });
    if (res.status === 422) {
      const parsed = await this.parseJson(res);
      const errors = this.extractValidationErrors(parsed);
      throw new RedmineError("validation", { status: 422, errors });
    }
    throw new RedmineError("server", { status: res.status });
  }

  private async parseJson(res: Response): Promise<unknown> {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  }

  private extractValidationErrors(parsed: unknown): string[] {
    if (parsed && typeof parsed === "object" && "errors" in parsed) {
      const e = (parsed as { errors: unknown }).errors;
      if (Array.isArray(e)) return e.map((x) => String(x));
    }
    return [];
  }

  private ensureTrailingSlash(u: URL): URL {
    if (u.pathname.endsWith("/")) return u;
    return new URL(u.pathname + "/", u);
  }
}

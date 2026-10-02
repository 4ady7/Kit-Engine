import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { FileRepository, defaultStorePath } from "./fileRepository.ts";
import { routeApi } from "./handlers.ts";
import type { Repository } from "./repository.ts";

async function createRepository(): Promise<Repository> {
  if (process.env.DATABASE_URL) {
    try {
      const { PostgresRepository } = await import("./postgresRepository.ts");
      return await PostgresRepository.connect(process.env.DATABASE_URL);
    } catch (error) {
      console.error("PostgreSQL is unavailable. Kit Engine is using the file store.", error);
    }
  }
  return new FileRepository(defaultStorePath());
}

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 100_000) throw new Error("body-too-large");
    chunks.push(buffer);
  }
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
  }
  return new Request(`http://kit.local${req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: body.length > 0 && req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
  });
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const payload = Buffer.from(await response.arrayBuffer());
  res.end(payload);
}

export function kitApiPlugin(): Plugin {
  const repositoryPromise = createRepository();
  const handle = async (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    if (!req.url?.startsWith("/api/")) {
      next();
      return;
    }
    try {
      const repository = await repositoryPromise;
      const request = await toWebRequest(req);
      const response = await routeApi(request, repository);
      if (!response) {
        next();
        return;
      }
      await send(res, response);
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === "body-too-large";
      res.statusCode = tooLarge ? 413 : 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        error: tooLarge ? "The request body is too large." : "The server could not complete that request.",
      }));
    }
  };

  const middleware = (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    void handle(req, res, next);
  };

  return {
    name: "kit-api",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

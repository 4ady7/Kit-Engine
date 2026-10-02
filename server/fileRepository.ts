import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Configuration } from "../src/engine/types.ts";
import type { Repository, StoredConfiguration, StoredRule } from "./repository.ts";

interface StoreFile {
  configurations: Record<string, StoredConfiguration>;
  rules: Record<string, StoredRule>;
}

function emptyStore(): StoreFile {
  return { configurations: {}, rules: {} };
}

/**
 * Zero-config persistence. The shape matches the PostgreSQL tables in schema.sql.
 * Writes are serialised so two shares cannot clobber the file.
 */
export class FileRepository implements Repository {
  private chain: Promise<void> = Promise.resolve();
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async read(): Promise<StoreFile> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoreFile>;
      return {
        configurations: parsed.configurations ?? {},
        rules: parsed.rules ?? {},
      };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return emptyStore();
      throw error;
    }
  }

  private async write(store: StoreFile): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(store, null, 2));
  }

  insertConfiguration(input: {
    id: string;
    title: string;
    author: string | null;
    parameters: Configuration;
  }): Promise<StoredConfiguration> {
    return this.enqueue(async () => {
      const store = await this.read();
      const now = new Date().toISOString();
      const record: StoredConfiguration = {
        id: input.id,
        version: 1,
        title: input.title,
        author: input.author,
        parameters: input.parameters,
        createdAt: now,
        updatedAt: now,
      };
      store.configurations[record.id] = record;
      await this.write(store);
      return record;
    });
  }

  getConfiguration(id: string): Promise<StoredConfiguration | null> {
    return this.enqueue(async () => {
      const store = await this.read();
      return store.configurations[id] ?? null;
    });
  }

  listRules(): Promise<StoredRule[]> {
    return this.enqueue(async () => {
      const store = await this.read();
      return Object.values(store.rules);
    });
  }

  insertRule(rule: StoredRule): Promise<void> {
    return this.enqueue(async () => {
      const store = await this.read();
      store.rules[rule.id] = rule;
      await this.write(store);
    });
  }

  deleteRule(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const store = await this.read();
      if (!store.rules[id]) return false;
      delete store.rules[id];
      await this.write(store);
      return true;
    });
  }
}

export function defaultStorePath(): string {
  return process.env.KIT_STORE_PATH ?? path.join(process.cwd(), "data", "store.json");
}

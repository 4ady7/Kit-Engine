import type { Configuration } from "../src/engine/types.ts";
import type { Repository, StoredConfiguration, StoredRule } from "./repository.ts";

export class MemoryRepository implements Repository {
  private readonly configurations = new Map<string, StoredConfiguration>();
  private readonly rules = new Map<string, StoredRule>();

  insertConfiguration(input: {
    id: string;
    title: string;
    author: string | null;
    parameters: Configuration;
  }): Promise<StoredConfiguration> {
    const now = new Date().toISOString();
    const record: StoredConfiguration = {
      id: input.id,
      version: 1,
      title: input.title,
      author: input.author,
      parameters: structuredClone(input.parameters),
      createdAt: now,
      updatedAt: now,
    };
    this.configurations.set(record.id, record);
    return Promise.resolve(record);
  }

  getConfiguration(id: string): Promise<StoredConfiguration | null> {
    const found = this.configurations.get(id);
    return Promise.resolve(found ? structuredClone(found) : null);
  }

  listRules(): Promise<StoredRule[]> {
    return Promise.resolve([...this.rules.values()].map((rule) => ({ ...rule })));
  }

  insertRule(rule: StoredRule): Promise<void> {
    this.rules.set(rule.id, { ...rule });
    return Promise.resolve();
  }

  deleteRule(id: string): Promise<boolean> {
    return Promise.resolve(this.rules.delete(id));
  }
}

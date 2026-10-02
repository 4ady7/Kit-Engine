import type { Configuration } from "../src/engine/types.ts";

export interface StoredConfiguration {
  id: string;
  version: 1;
  title: string;
  author: string | null;
  parameters: Configuration;
  createdAt: string;
  updatedAt: string;
}

export interface StoredRule {
  id: string;
  dsl: string;
  createdAt: string;
}

export interface Repository {
  insertConfiguration(input: {
    id: string;
    title: string;
    author: string | null;
    parameters: Configuration;
  }): Promise<StoredConfiguration>;
  getConfiguration(id: string): Promise<StoredConfiguration | null>;
  listRules(): Promise<StoredRule[]>;
  insertRule(rule: StoredRule): Promise<void>;
  deleteRule(id: string): Promise<boolean>;
}

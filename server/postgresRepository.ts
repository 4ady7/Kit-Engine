import { Pool } from "pg";
import type { Configuration } from "../src/engine/types.ts";
import type { Repository, StoredConfiguration, StoredRule } from "./repository.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS configurations (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  parameters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_rules (
  id TEXT PRIMARY KEY,
  dsl TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

interface ConfigurationRow {
  id: string;
  version: number;
  title: string;
  author: string | null;
  parameters: Configuration;
  created_at: Date;
  updated_at: Date;
}

interface RuleRow {
  id: string;
  dsl: string;
  created_at: Date;
}

function toConfiguration(row: ConfigurationRow): StoredConfiguration {
  return {
    id: row.id,
    version: 1,
    title: row.title,
    author: row.author,
    parameters: row.parameters,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class PostgresRepository implements Repository {
  private readonly pool: Pool;

  private constructor(pool: Pool) {
    this.pool = pool;
  }

  static async connect(connectionString: string): Promise<PostgresRepository> {
    const pool = new Pool({ connectionString, max: 4 });
    await pool.query(SCHEMA);
    return new PostgresRepository(pool);
  }

  async insertConfiguration(input: {
    id: string;
    title: string;
    author: string | null;
    parameters: Configuration;
  }): Promise<StoredConfiguration> {
    const result = await this.pool.query<ConfigurationRow>(
      `INSERT INTO configurations (id, version, title, author, parameters)
       VALUES ($1, 1, $2, $3, $4::jsonb)
       RETURNING id, version, title, author, parameters, created_at, updated_at`,
      [input.id, input.title, input.author, JSON.stringify(input.parameters)],
    );
    const row = result.rows[0];
    if (!row) throw new Error("The configuration insert did not return a row.");
    return toConfiguration(row);
  }

  async getConfiguration(id: string): Promise<StoredConfiguration | null> {
    const result = await this.pool.query<ConfigurationRow>(
      `SELECT id, version, title, author, parameters, created_at, updated_at
       FROM configurations WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? toConfiguration(row) : null;
  }

  async listRules(): Promise<StoredRule[]> {
    const result = await this.pool.query<RuleRow>(
      `SELECT id, dsl, created_at FROM custom_rules ORDER BY created_at ASC`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      dsl: row.dsl,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async insertRule(rule: StoredRule): Promise<void> {
    await this.pool.query(
      `INSERT INTO custom_rules (id, dsl, created_at) VALUES ($1, $2, $3)`,
      [rule.id, rule.dsl, rule.createdAt],
    );
  }

  async deleteRule(id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM custom_rules WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

// Minimal type declarations for the 'pg' package (PostgreSQL client)
declare module 'pg' {
  export class Pool {
    constructor(config?: Record<string, unknown>);
    query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
    on(event: string, listener: (...args: unknown[]) => void): this;
    end(): Promise<void>;
  }
}

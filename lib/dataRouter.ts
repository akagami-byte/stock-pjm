import { supabase } from '@/lib/supabase';
import { getDatabase, ALL_TABLES } from '@/lib/database';
import { useAuthStore } from '@/stores/authStore';

/**
 * Data router — routes queries to Supabase (premium) or SQLite (basic/offline).
 * Premium users get real-time cloud sync. Basic users work offline-first.
 */

// ─── SQLite query adapter (mimics Supabase query builder subset) ────────

type FilterOp = { col: string; val: any; op: 'eq' | 'not_null' | 'is_null' | 'ilike' };
type OrderSpec = { col: string; dir: 'asc' | 'desc' };

class SQLiteQuery {
  private table: string;
  private columns = '*';
  private filters: FilterOp[] = [];
  private orders: OrderSpec[] = [];
  private limitVal: number | null = null;
  private singleMode = false;

  constructor(table: string) {
    this.table = table;
    this.reset();
  }

  private reset() {
    this.columns = '*';
    this.filters = [];
    this.orders = [];
    this.limitVal = null;
    this.singleMode = false;
  }

  select(cols = '*') { this.columns = cols; return this; }
  eq(col: string, val: any) { this.filters.push({ col, val, op: 'eq' }); return this; }
  not(col: string, _op: string, _val: null) { this.filters.push({ col, val: null, op: 'not_null' }); return this; }
  is(col: string, _val: null) { this.filters.push({ col, val: null, op: 'is_null' }); return this; }
  ilike(col: string, val: string) { this.filters.push({ col, val, op: 'ilike' }); return this; }
  order(col: string, opts: { ascending: boolean }) { this.orders.push({ col, dir: opts.ascending ? 'asc' : 'desc' }); return this; }
  limit(n: number) { this.limitVal = n; return this; }
  single() { this.singleMode = true; return this; }

  // Execute SELECT
  async then<T = any>(resolve: (value: { data: T[] | null; error: any }) => void) {
    try {
      const db = await getDatabase();
      let sql = `SELECT ${this.columns} FROM ${this.table}`;
      const params: any[] = [];

      if (this.filters.length > 0) {
        const clauses = this.filters.map((f) => {
          switch (f.op) {
            case 'eq': params.push(f.val); return `${f.col} = ?`;
            case 'not_null': return `${f.col} IS NOT NULL`;
            case 'is_null': return `${f.col} IS NULL`;
            case 'ilike': params.push(f.val); return `${f.col} LIKE ?`;
            default: return '1=1';
          }
        });
        sql += ` WHERE ${clauses.join(' AND ')}`;
      }

      if (this.orders.length > 0) {
        const orderClauses = this.orders.map((o) => `${o.col} ${o.dir}`);
        sql += ` ORDER BY ${orderClauses.join(', ')}`;
      }

      if (this.limitVal !== null) {
        sql += ` LIMIT ${this.limitVal}`;
      }

      const rows = await db.getAllAsync(sql, params);

      if (this.singleMode) {
        resolve({ data: (rows.length > 0 ? rows[0] : null) as any, error: null });
      } else {
        resolve({ data: rows as T[], error: null });
      }
    } catch (error) {
      resolve({ data: null, error });
    } finally {
      this.reset();
    }
  }

  // Execute INSERT
  async insert(payload: any | any[]) {
    try {
      const db = await getDatabase();
      const items = Array.isArray(payload) ? payload : [payload];

      for (const item of items) {
        const keys = Object.keys(item);
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`;
        await db.runAsync(sql, keys.map((k) => item[k]));
      }

      return { data: items, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  // Execute UPDATE
  async update(payload: any) {
    try {
      const db = await getDatabase();
      const sets = Object.keys(payload).map((k) => `${k} = ?`).join(', ');
      const values = Object.values(payload);

      let sql = `UPDATE ${this.table} SET ${sets}`;
      const params: any[] = [...values];

      if (this.filters.length > 0) {
        const clauses = this.filters.map((f) => {
          if (f.op === 'eq') { params.push(f.val); return `${f.col} = ?`; }
          return '1=1';
        });
        sql += ` WHERE ${clauses.join(' AND ')}`;
      }

      await db.runAsync(sql, params);
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error };
    } finally {
      this.reset();
    }
  }
}

// ─── Router ─────────────────────────────────────────────────────────────

/**
 * Returns query builder for given table.
 * Premium → Supabase (real Postgres)
 * Basic  → SQLite (offline-first)
 */
export function getQuery(table: string) {
  const isPremium = useAuthStore.getState().user?.is_premium ?? false;

  // Premium: real Supabase
  if (isPremium) {
    return supabase.from(table);
  }

  // Basic/offline: SQLite adapter
  return new SQLiteQuery(table) as any;
}

/**
 * Execute an RPC call.
 * Premium → Supabase RPC
 * Basic  → throws (RPC not available offline)
 */
export async function rpc(fnName: string, params: Record<string, any>) {
  const isPremium = useAuthStore.getState().user?.is_premium ?? false;

  if (isPremium) {
    return supabase.rpc(fnName as any, params);
  }

  // Basic user: no RPC support — caller must handle
  throw new Error(`RPC ${fnName} not available in offline mode`);
}

/**
 * Get authenticated user (works for both premium and basic).
 */
export async function getAuthUser() {
  return supabase.auth.getUser();
}

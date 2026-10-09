import { Pool } from "pg";

export type Query = <T = Record<string, any>>(sql: string, params?: unknown[]) => Promise<T[]>;

type Db = {
  query: Query;
  exec: (sql: string) => Promise<void>;
  tx: <T>(fn: (q: Query) => Promise<T>) => Promise<T>;
};

const g = globalThis as unknown as { __drDb?: Promise<Db>; __drReady?: Promise<void> };

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (url) {
    const pool = new Pool({ connectionString: url, max: 3 });
    const query: Query = async (sql, params) => (await pool.query(sql, params as any[])).rows;
    return {
      query,
      exec: async (sql) => void (await pool.query(sql)),
      tx: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const q: Query = async (sql, params) => (await client.query(sql, params as any[])).rows;
          const out = await fn(q);
          await client.query("COMMIT");
          return out;
        } catch (e) {
          await client.query("ROLLBACK").catch(() => {});
          throw e;
        } finally {
          client.release();
        }
      },
    };
  }

  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_MEMORY_DB) {
    throw new Error("DATABASE_URL is not set. Add a Postgres database to the Vercel project.");
  }

  // Local development and tests: throwaway in-memory Postgres. Data is lost on restart.
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite();
  const query: Query = async (sql, params) => (await pg.query(sql, params as any[])).rows as any;
  return {
    query,
    exec: async (sql) => void (await pg.exec(sql)),
    tx: (fn) =>
      pg.transaction(async (t) => fn(async (sql, params) => (await t.query(sql, params as any[])).rows as any)),
  };
}

export function getDb(): Promise<Db> {
  g.__drDb ??= connect();
  return g.__drDb;
}

const SCHEMA = `
create table if not exists players (
  id uuid primary key,
  invite_code text unique not null,
  invited_by uuid references players(id),
  email text,
  email_consent boolean not null default false,
  age_confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table players add column if not exists recap_seen_week text;
alter table players add column if not exists rewards_notify boolean not null default false;
alter table players add column if not exists email_bonus_granted boolean not null default false;
alter table players add column if not exists nickname text;
alter table players add column if not exists board_visible boolean not null default true;
create table if not exists spins (
  id bigserial primary key,
  player_id uuid not null references players(id),
  play_date text not null,
  week_start text not null,
  spin_number int not null,
  is_bonus boolean not null default false,
  symbols jsonb not null,
  outcome text not null,
  points int not null,
  created_at timestamptz not null default now(),
  unique (player_id, play_date, spin_number)
);
alter table spins add column if not exists is_signup_bonus boolean not null default false;
alter table spins add column if not exists bonus_points int not null default 0;
alter table spins add column if not exists bonus_claimed boolean not null default false;
create index if not exists spins_player_week on spins (player_id, week_start);
create table if not exists bonus_grants (
  id bigserial primary key,
  inviter_id uuid not null references players(id),
  invitee_id uuid not null unique references players(id),
  week_start text not null,
  created_at timestamptz not null default now()
);
create table if not exists set_awards (
  id bigserial primary key,
  player_id uuid not null references players(id),
  set_id text not null,
  week_start text not null,
  points int not null,
  created_at timestamptz not null default now(),
  unique (player_id, set_id)
);
create table if not exists mission_awards (
  player_id uuid not null references players(id),
  play_date text not null,
  week_start text not null,
  mission_id text not null,
  points int not null,
  created_at timestamptz not null default now(),
  primary key (player_id, play_date)
);
create table if not exists events (
  id bigserial primary key,
  player_id uuid,
  name text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
`;

/** Runs once per server instance. Safe to call on every request. */
export async function ready(): Promise<Db> {
  const db = await getDb();
  g.__drReady ??= db.exec(SCHEMA);
  await g.__drReady;
  return db;
}

export async function logEvent(playerId: string | null, name: string, meta?: unknown) {
  try {
    const db = await ready();
    await db.query("insert into events (player_id, name, meta) values ($1, $2, $3)", [
      playerId,
      name,
      meta ? JSON.stringify(meta) : null,
    ]);
  } catch (e) {
    console.error("event log failed", name, e);
  }
}

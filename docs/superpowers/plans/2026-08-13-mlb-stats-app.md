# MLB選手成績アプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MLB公式無料API(statsapi.mlb.com)を使い、選手検索・個人成績・リーダーボード・チーム順位・選手比較ができる公開Webサービスを構築する。

**Architecture:** Next.js (App Router, TypeScript) をVercel Hobbyにデプロイし、Server ComponentsからSupabase(Postgres)を読み取る。MLB公式APIへのアクセスはサーバー側のみ(日次バッチ + オンデマンド取得)で行い、フロントエンドは常にSupabase経由でデータを読む。

**Tech Stack:** Next.js 15 (App Router) / TypeScript / Tailwind CSS / Supabase (`@supabase/supabase-js`) / Vitest / Vercel (Hobby, Vercel Cron)

## Global Constraints

- デプロイ先はVercel Hobby(無料)プラン。Vercel CronはHobbyでは1日1回までの実行に制限される — 日次バッチは1日1回のみ実行する設計とする。
- サーバーレス関数の実行時間上限に収まるよう、選手ごとのAPI呼び出しは並列度を制限した並行処理で行う(`maxDuration = 60`)。
- フロントエンド(ブラウザ/Server Component経由の読み取り)はSupabaseからのみデータを取得し、MLB公式APIを直接呼び出さない。
- MLB Stats APIのベースURLは `https://statsapi.mlb.com/api/v1`。APIキー不要。
- 対象は現行バージョンではMLBのみ。NPB対応・リアルタイム反映は対象外。
- データ取得ロジック(MLB API→変換処理)はモックを使ったユニットテストで検証する。バッチ処理・フロントページは自動テストを設けず、手動実行・ブラウザ確認で検証する(spec方針に準拠)。

---

## Task 1: Next.jsプロジェクトの初期化

**Files:**
- Create: プロジェクト一式(`package.json`, `tsconfig.json`, `next.config.ts`, `src/app/*` 等 — `create-next-app`が生成)

**Interfaces:**
- Produces: `npm run dev` / `npm run build` / `npm run lint` コマンド、`@/*` → `src/*` のパスエイリアス

- [ ] **Step 1: create-next-appでプロジェクトを生成する**

`C:\Users\samus\mlb-stats-app` ディレクトリ内で実行:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

プロンプトが出た場合はデフォルト(Yes)で進める。

- [ ] **Step 2: 開発サーバーが起動することを確認する**

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開き、Next.jsのデフォルトページが表示されることを確認したら `Ctrl+C` で停止する。

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "chore: initialize Next.js project"
```

---

## Task 2: Vitestのセットアップ

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`
- Modify: `package.json` (test scriptを追加)

**Interfaces:**
- Produces: `npm test` コマンド、`@/*` エイリアスがテストからも解決できる設定

- [ ] **Step 1: Vitestをインストール**

```bash
npm install -D vitest
```

- [ ] **Step 2: vitest.config.tsを作成**

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: package.jsonにtestスクリプトを追加**

`package.json` の `"scripts"` に以下を追加:

```json
"test": "vitest run"
```

- [ ] **Step 4: スモークテストを書く**

`tests/smoke.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("smoke test", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: テストを実行して通ることを確認**

```bash
npm test
```

Expected: `1 passed`

- [ ] **Step 6: コミット**

```bash
git add package.json package-lock.json vitest.config.ts tests/smoke.test.ts
git commit -m "chore: configure Vitest"
```

---

## Task 3: Supabaseクライアントとenv設定

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `.env.local.example`

**Interfaces:**
- Produces: `createSupabaseClient(): SupabaseClient`(読み取り専用・anon key)、`createSupabaseAdminClient(): SupabaseClient`(書き込み用・service role key、サーバー専用)

- [ ] **Step 1: supabase-jsをインストール**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: env例ファイルを作成**

`.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

実際の値は `.env.local` に記入する(`create-next-app`が`.gitignore`に`.env*.local`を含めているためコミットされない)。SupabaseダッシュボードのProject Settings → API から `Project URL` / `anon public` key / `service_role` key を取得して転記する。`CRON_SECRET`は任意のランダム文字列を自分で生成して設定する。

- [ ] **Step 3: 読み取り用クライアントを作成**

`src/lib/supabase/client.ts`:

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 4: 書き込み用(管理者)クライアントを作成**

`src/lib/supabase/admin.ts`:

```typescript
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

`admin.ts` はバッチ処理・オンデマンド取得・APIルートなどサーバー専用コードからのみimportする(クライアントコンポーネントからimportしない)。

- [ ] **Step 5: 型チェックを実行**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add package.json package-lock.json .env.local.example src/lib/supabase
git commit -m "feat: add Supabase client wrappers"
```

---

## Task 4: Supabaseスキーママイグレーション

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: テーブル `teams`, `players`, `season_stats`, `career_stats`, `team_standings`(すべて後続タスクのDB層が依存する)

- [ ] **Step 1: マイグレーションSQLを書く**

`supabase/migrations/0001_init.sql`:

```sql
create extension if not exists pg_trgm;

create table if not exists teams (
  id integer primary key,
  name text not null,
  abbreviation text not null,
  league text,
  division text
);

create table if not exists players (
  id integer primary key,
  full_name text not null,
  primary_position text,
  birth_date date,
  mlb_debut_date date,
  is_active boolean not null default false,
  last_synced_at timestamptz not null default now(),
  history_synced boolean not null default false
);

create index if not exists players_full_name_trgm_idx on players using gin (full_name gin_trgm_ops);
create index if not exists players_is_active_idx on players (is_active);

create table if not exists season_stats (
  player_id integer not null references players(id),
  season integer not null,
  stat_type text not null check (stat_type in ('hitting', 'pitching')),
  team_id integer not null references teams(id),
  games integer,
  avg numeric,
  hr integer,
  rbi integer,
  obp numeric,
  slg numeric,
  ops numeric,
  sb integer,
  so integer,
  wins integer,
  losses integer,
  era numeric,
  whip numeric,
  saves integer,
  innings_pitched numeric,
  primary key (player_id, season, stat_type, team_id)
);

create index if not exists season_stats_season_stat_type_idx on season_stats (season, stat_type);

create table if not exists career_stats (
  player_id integer not null references players(id),
  stat_type text not null check (stat_type in ('hitting', 'pitching')),
  games integer,
  avg numeric,
  hr integer,
  rbi integer,
  obp numeric,
  slg numeric,
  ops numeric,
  sb integer,
  so integer,
  wins integer,
  losses integer,
  era numeric,
  whip numeric,
  saves integer,
  innings_pitched numeric,
  primary key (player_id, stat_type)
);

create table if not exists team_standings (
  team_id integer not null references teams(id),
  season integer not null,
  wins integer not null,
  losses integer not null,
  win_pct numeric not null,
  division_rank integer,
  games_back numeric,
  updated_at timestamptz not null default now(),
  primary key (team_id, season)
);

alter table teams enable row level security;
alter table players enable row level security;
alter table season_stats enable row level security;
alter table career_stats enable row level security;
alter table team_standings enable row level security;

create policy "public read teams" on teams for select using (true);
create policy "public read players" on players for select using (true);
create policy "public read season_stats" on season_stats for select using (true);
create policy "public read career_stats" on career_stats for select using (true);
create policy "public read team_standings" on team_standings for select using (true);
```

RLSは全テーブルでSELECTのみanonに許可し、INSERT/UPDATE/DELETEポリシーは作らない(service roleはRLSをバイパスするため書き込みはそちらのみ可能)。

- [ ] **Step 2: SupabaseプロジェクトにSQLを適用する**

Supabaseダッシュボードの SQL Editor を開き、`0001_init.sql` の内容を貼り付けて実行する。

- [ ] **Step 3: テーブルが作成されたことを確認する**

SupabaseダッシュボードのTable Editorで `teams`, `players`, `season_stats`, `career_stats`, `team_standings` の5テーブルが存在することを目視確認する。

- [ ] **Step 4: コミット**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add initial Supabase schema"
```

---

## Task 5: MLB APIクライアント — 一覧系エンドポイント

**Files:**
- Create: `src/lib/mlb-api/types.ts`
- Create: `src/lib/mlb-api/client.ts`
- Test: `tests/lib/mlb-api/client.test.ts`

**Interfaces:**
- Produces: `fetchPlayersBySeason(season: number): Promise<MlbPerson[]>`, `fetchTeams(season: number): Promise<MlbTeam[]>`, `fetchStandings(season: number): Promise<MlbTeamRecord[]>`, 型 `MlbPerson`, `MlbTeam`, `MlbTeamRecord`

- [ ] **Step 1: MLB API型定義を書く**

`src/lib/mlb-api/types.ts`:

```typescript
export interface MlbPlayersResponse {
  people: MlbPerson[];
}

export interface MlbPerson {
  id: number;
  fullName: string;
  primaryPosition?: { abbreviation: string };
  birthDate?: string;
  mlbDebutDate?: string;
  active?: boolean;
}

export interface MlbTeamsResponse {
  teams: MlbTeam[];
}

export interface MlbTeam {
  id: number;
  name: string;
  abbreviation: string;
  league?: { name: string };
  division?: { name: string };
}

export interface MlbStandingsResponse {
  records: MlbStandingsRecord[];
}

export interface MlbStandingsRecord {
  teamRecords: MlbTeamRecord[];
}

export interface MlbTeamRecord {
  team: { id: number };
  wins: number;
  losses: number;
  winningPercentage: string;
  divisionRank: string;
  gamesBack: string;
}

export interface MlbPlayerStatsResponse {
  stats: MlbStatGroup[];
}

export interface MlbStatGroup {
  group: { displayName: string };
  type: { displayName: string };
  splits: MlbStatSplit[];
}

export interface MlbStatSplit {
  season?: string;
  team?: { id: number };
  stat: Record<string, string | number | undefined>;
}
```

- [ ] **Step 2: 失敗する一覧系テストを書く**

`tests/lib/mlb-api/client.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchPlayersBySeason, fetchTeams, fetchStandings } from "@/lib/mlb-api/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchPlayersBySeason", () => {
  it("returns the people array from the response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ people: [{ id: 1, fullName: "Test" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const players = await fetchPlayersBySeason(2026);

    expect(players).toEqual([{ id: 1, fullName: "Test" }]);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://statsapi.mlb.com/api/v1/sports/1/players?season=2026"
    );
  });

  it("throws when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchPlayersBySeason(2026)).rejects.toThrow("MLB API request failed: 500");
  });
});

describe("fetchTeams", () => {
  it("returns the teams array", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ teams: [{ id: 119, name: "Dodgers" }] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const teams = await fetchTeams(2026);
    expect(teams).toEqual([{ id: 119, name: "Dodgers" }]);
  });
});

describe("fetchStandings", () => {
  it("flattens teamRecords across all division records", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        records: [
          { teamRecords: [{ team: { id: 1 } }] },
          { teamRecords: [{ team: { id: 2 } }, { team: { id: 3 } }] },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const records = await fetchStandings(2026);
    expect(records).toHaveLength(3);
  });
});
```

- [ ] **Step 3: テストを実行して失敗することを確認**

```bash
npm test -- tests/lib/mlb-api/client.test.ts
```

Expected: FAIL(`client.ts` が存在しないためモジュール解決エラー)

- [ ] **Step 4: クライアントを実装**

`src/lib/mlb-api/client.ts`:

```typescript
import type {
  MlbPlayersResponse,
  MlbPerson,
  MlbTeamsResponse,
  MlbTeam,
  MlbStandingsResponse,
  MlbTeamRecord,
} from "./types";

const BASE_URL = "https://statsapi.mlb.com/api/v1";

async function mlbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`MLB API request failed: ${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchPlayersBySeason(season: number): Promise<MlbPerson[]> {
  const data = await mlbFetch<MlbPlayersResponse>(`/sports/1/players?season=${season}`);
  return data.people ?? [];
}

export async function fetchTeams(season: number): Promise<MlbTeam[]> {
  const data = await mlbFetch<MlbTeamsResponse>(`/teams?sportId=1&season=${season}`);
  return data.teams ?? [];
}

export async function fetchStandings(season: number): Promise<MlbTeamRecord[]> {
  const data = await mlbFetch<MlbStandingsResponse>(
    `/standings?leagueId=103,104&season=${season}`
  );
  return data.records.flatMap((r) => r.teamRecords);
}
```

- [ ] **Step 5: テストを実行して通ることを確認**

```bash
npm test -- tests/lib/mlb-api/client.test.ts
```

Expected: 全テストPASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/mlb-api/types.ts src/lib/mlb-api/client.ts tests/lib/mlb-api/client.test.ts
git commit -m "feat: add MLB API list endpoint client"
```

---

## Task 6: MLB APIクライアント — 選手成績エンドポイント

**Files:**
- Modify: `src/lib/mlb-api/client.ts`
- Modify: `tests/lib/mlb-api/client.test.ts`

**Interfaces:**
- Consumes: `mlbFetch<T>(path: string)`(Task 5で定義)
- Produces: `fetchPlayerStats(playerId: number, stats: string, season?: number): Promise<MlbStatGroup[]>`

- [ ] **Step 1: 失敗するテストを追加**

`tests/lib/mlb-api/client.test.ts` に追記:

```typescript
import { fetchPlayerStats } from "@/lib/mlb-api/client";

describe("fetchPlayerStats", () => {
  it("builds the correct URL with stats and season", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ stats: [] }) });
    vi.stubGlobal("fetch", mockFetch);

    await fetchPlayerStats(660271, "season,career", 2026);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://statsapi.mlb.com/api/v1/people/660271/stats?stats=season,career&group=hitting,pitching&season=2026"
    );
  });

  it("omits the season param when not provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ stats: [] }) });
    vi.stubGlobal("fetch", mockFetch);

    await fetchPlayerStats(660271, "career");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://statsapi.mlb.com/api/v1/people/660271/stats?stats=career&group=hitting,pitching"
    );
  });
});
```

(既存の `import { fetchPlayersBySeason, fetchTeams, fetchStandings } from "@/lib/mlb-api/client";` の行に `fetchPlayerStats` を追加してまとめても良い)

- [ ] **Step 2: テストを実行して失敗することを確認**

```bash
npm test -- tests/lib/mlb-api/client.test.ts
```

Expected: FAIL(`fetchPlayerStats` が存在しない)

- [ ] **Step 3: 実装を追加**

`src/lib/mlb-api/client.ts` に追記(importに `MlbPlayerStatsResponse`, `MlbStatGroup` を追加):

```typescript
import type {
  MlbPlayersResponse,
  MlbPerson,
  MlbTeamsResponse,
  MlbTeam,
  MlbStandingsResponse,
  MlbTeamRecord,
  MlbPlayerStatsResponse,
  MlbStatGroup,
} from "./types";

// ...(既存のmlbFetch, fetchPlayersBySeason, fetchTeams, fetchStandingsはそのまま)

export async function fetchPlayerStats(
  playerId: number,
  stats: string,
  season?: number
): Promise<MlbStatGroup[]> {
  const seasonParam = season ? `&season=${season}` : "";
  const data = await mlbFetch<MlbPlayerStatsResponse>(
    `/people/${playerId}/stats?stats=${stats}&group=hitting,pitching${seasonParam}`
  );
  return data.stats ?? [];
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

```bash
npm test -- tests/lib/mlb-api/client.test.ts
```

Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/mlb-api/client.ts tests/lib/mlb-api/client.test.ts
git commit -m "feat: add MLB API player stats client"
```

---

## Task 7: MLB APIデータ変換 — 選手/チーム/順位表

**Files:**
- Create: `src/lib/db/types.ts`
- Create: `src/lib/mlb-api/transform.ts`
- Test: `tests/lib/mlb-api/transform.test.ts`

**Interfaces:**
- Consumes: `MlbPerson`, `MlbTeam`, `MlbTeamRecord`(Task 5)
- Produces: 型 `PlayerRow`, `TeamRow`, `StandingRow`, `StatFields`, `SeasonStatRow`, `CareerStatRow`。関数 `mapPlayer(person: MlbPerson): PlayerRow`, `mapTeam(team: MlbTeam): TeamRow`, `mapStanding(record: MlbTeamRecord, season: number): StandingRow`

- [ ] **Step 1: DB行の型定義を書く**

`src/lib/db/types.ts`:

```typescript
export interface PlayerRow {
  id: number;
  full_name: string;
  primary_position: string | null;
  birth_date: string | null;
  mlb_debut_date: string | null;
  is_active: boolean;
  last_synced_at: string;
  history_synced?: boolean;
}

export interface TeamRow {
  id: number;
  name: string;
  abbreviation: string;
  league: string | null;
  division: string | null;
}

export interface StandingRow {
  team_id: number;
  season: number;
  wins: number;
  losses: number;
  win_pct: number;
  division_rank: number;
  games_back: number;
  updated_at: string;
}

export interface StatFields {
  games: number | null;
  avg: number | null;
  hr: number | null;
  rbi: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  sb: number | null;
  so: number | null;
  wins: number | null;
  losses: number | null;
  era: number | null;
  whip: number | null;
  saves: number | null;
  innings_pitched: number | null;
}

export type StatType = "hitting" | "pitching";

export interface SeasonStatRow extends StatFields {
  player_id: number;
  season: number;
  stat_type: StatType;
  team_id: number;
}

export interface CareerStatRow extends StatFields {
  player_id: number;
  stat_type: StatType;
}
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/lib/mlb-api/transform.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mapPlayer, mapTeam, mapStanding } from "@/lib/mlb-api/transform";
import type { MlbPerson, MlbTeam, MlbTeamRecord } from "@/lib/mlb-api/types";

describe("mapPlayer", () => {
  it("maps an active player", () => {
    const person: MlbPerson = {
      id: 660271,
      fullName: "Shohei Ohtani",
      primaryPosition: { abbreviation: "DH" },
      birthDate: "1994-07-05",
      mlbDebutDate: "2018-03-29",
      active: true,
    };
    const row = mapPlayer(person);
    expect(row).toMatchObject({
      id: 660271,
      full_name: "Shohei Ohtani",
      primary_position: "DH",
      birth_date: "1994-07-05",
      mlb_debut_date: "2018-03-29",
      is_active: true,
    });
  });

  it("defaults missing fields to null/false", () => {
    const row = mapPlayer({ id: 1, fullName: "Test Player" });
    expect(row.primary_position).toBeNull();
    expect(row.is_active).toBe(false);
  });
});

describe("mapTeam", () => {
  it("maps team fields", () => {
    const team: MlbTeam = {
      id: 119,
      name: "Los Angeles Dodgers",
      abbreviation: "LAD",
      league: { name: "National League" },
      division: { name: "National League West" },
    };
    expect(mapTeam(team)).toEqual({
      id: 119,
      name: "Los Angeles Dodgers",
      abbreviation: "LAD",
      league: "National League",
      division: "National League West",
    });
  });
});

describe("mapStanding", () => {
  it("treats '-' games back as first place (0)", () => {
    const record: MlbTeamRecord = {
      team: { id: 119 },
      wins: 100,
      losses: 62,
      winningPercentage: ".617",
      divisionRank: "1",
      gamesBack: "-",
    };
    const row = mapStanding(record, 2026);
    expect(row).toEqual({
      team_id: 119,
      season: 2026,
      wins: 100,
      losses: 62,
      win_pct: 0.617,
      division_rank: 1,
      games_back: 0,
      updated_at: row.updated_at,
    });
  });

  it("parses a non-zero games back value", () => {
    const record: MlbTeamRecord = {
      team: { id: 121 },
      wins: 90,
      losses: 72,
      winningPercentage: ".556",
      divisionRank: "2",
      gamesBack: "10.0",
    };
    expect(mapStanding(record, 2026).games_back).toBe(10);
  });
});
```

- [ ] **Step 3: テストを実行して失敗することを確認**

```bash
npm test -- tests/lib/mlb-api/transform.test.ts
```

Expected: FAIL(`transform.ts` が存在しない)

- [ ] **Step 4: 実装を書く**

`src/lib/mlb-api/transform.ts`:

```typescript
import type { MlbPerson, MlbTeam, MlbTeamRecord } from "./types";
import type { PlayerRow, TeamRow, StandingRow } from "../db/types";

export function mapPlayer(person: MlbPerson): PlayerRow {
  return {
    id: person.id,
    full_name: person.fullName,
    primary_position: person.primaryPosition?.abbreviation ?? null,
    birth_date: person.birthDate ?? null,
    mlb_debut_date: person.mlbDebutDate ?? null,
    is_active: person.active ?? false,
    last_synced_at: new Date().toISOString(),
  };
}

export function mapTeam(team: MlbTeam): TeamRow {
  return {
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    league: team.league?.name ?? null,
    division: team.division?.name ?? null,
  };
}

export function mapStanding(record: MlbTeamRecord, season: number): StandingRow {
  return {
    team_id: record.team.id,
    season,
    wins: record.wins,
    losses: record.losses,
    win_pct: parseFloat(record.winningPercentage),
    division_rank: parseInt(record.divisionRank, 10),
    games_back: record.gamesBack === "-" ? 0 : parseFloat(record.gamesBack),
    updated_at: new Date().toISOString(),
  };
}
```

`mapPlayer` はあえて `history_synced` を含めない(Task 10のupsertで既存の値を上書きしないため)。

- [ ] **Step 5: テストを実行して通ることを確認**

```bash
npm test -- tests/lib/mlb-api/transform.test.ts
```

Expected: 全テストPASS

- [ ] **Step 6: コミット**

```bash
git add src/lib/db/types.ts src/lib/mlb-api/transform.ts tests/lib/mlb-api/transform.test.ts
git commit -m "feat: add player/team/standing transform functions"
```

---

## Task 8: MLB APIデータ変換 — シーズン別/通算成績

**Files:**
- Modify: `src/lib/mlb-api/transform.ts`
- Modify: `tests/lib/mlb-api/transform.test.ts`

**Interfaces:**
- Consumes: `MlbStatGroup`, `MlbStatSplit`(Task 5)、`SeasonStatRow`, `CareerStatRow`, `StatFields`(Task 7)
- Produces: `mapSeasonStats(playerId: number, groups: MlbStatGroup[]): SeasonStatRow[]`, `mapCareerStats(playerId: number, groups: MlbStatGroup[]): CareerStatRow[]`

このタスクは選手詳細ページとバッチ処理の両方が依存する最重要ロジック。MLB APIの `stats` パラメータには複数タイプ(例: `season,career` や `yearByYear,career`)を同時指定でき、レスポンスの `stats[].type.displayName` でタイプを判別できる。`mapSeasonStats` は `season`/`yearByYear` タイプのみ、`mapCareerStats` は `career` タイプのみを抽出することで、1回のAPI呼び出しレスポンスから両方を取り出せる。

- [ ] **Step 1: 失敗するテストを追加**

`tests/lib/mlb-api/transform.test.ts` に追記:

```typescript
import { mapSeasonStats, mapCareerStats } from "@/lib/mlb-api/transform";
import type { MlbStatGroup } from "@/lib/mlb-api/types";

describe("mapSeasonStats", () => {
  it("extracts hitting rows from yearByYear splits", () => {
    const groups: MlbStatGroup[] = [
      {
        group: { displayName: "hitting" },
        type: { displayName: "yearByYear" },
        splits: [
          {
            season: "2025",
            team: { id: 147 },
            stat: {
              gamesPlayed: 150,
              avg: ".285",
              homeRuns: 30,
              rbi: 90,
              obp: ".360",
              slg: ".520",
              ops: ".880",
              stolenBases: 10,
              strikeOuts: 120,
            },
          },
        ],
      },
    ];
    const rows = mapSeasonStats(660271, groups);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      player_id: 660271,
      season: 2025,
      stat_type: "hitting",
      team_id: 147,
      games: 150,
      avg: 0.285,
      hr: 30,
      rbi: 90,
      obp: 0.36,
      slg: 0.52,
      ops: 0.88,
      sb: 10,
      so: 120,
      era: null,
    });
  });

  it("extracts pitching rows and skips splits without a team", () => {
    const groups: MlbStatGroup[] = [
      {
        group: { displayName: "pitching" },
        type: { displayName: "yearByYear" },
        splits: [
          {
            season: "2025",
            team: { id: 147 },
            stat: {
              gamesPlayed: 20,
              wins: 12,
              losses: 5,
              era: "3.20",
              strikeOuts: 180,
              whip: "1.05",
              saves: 0,
              inningsPitched: "150.0",
            },
          },
          {
            season: "2025",
            stat: { gamesPlayed: 20 },
          },
        ],
      },
    ];
    const rows = mapSeasonStats(660271, groups);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      stat_type: "pitching",
      wins: 12,
      losses: 5,
      era: 3.2,
      whip: 1.05,
      saves: 0,
      innings_pitched: 150,
    });
  });

  it("ignores career-type groups", () => {
    const groups: MlbStatGroup[] = [
      {
        group: { displayName: "hitting" },
        type: { displayName: "career" },
        splits: [{ stat: { gamesPlayed: 500 } }],
      },
    ];
    expect(mapSeasonStats(1, groups)).toHaveLength(0);
  });
});

describe("mapCareerStats", () => {
  it("extracts a single career row per stat type", () => {
    const groups: MlbStatGroup[] = [
      {
        group: { displayName: "hitting" },
        type: { displayName: "career" },
        splits: [
          {
            stat: {
              gamesPlayed: 800,
              avg: ".270",
              homeRuns: 200,
              rbi: 600,
              obp: ".350",
              slg: ".480",
              ops: ".830",
              stolenBases: 80,
              strikeOuts: 700,
            },
          },
        ],
      },
    ];
    const rows = mapCareerStats(660271, groups);
    expect(rows).toEqual([
      {
        player_id: 660271,
        stat_type: "hitting",
        games: 800,
        avg: 0.27,
        hr: 200,
        rbi: 600,
        obp: 0.35,
        slg: 0.48,
        ops: 0.83,
        sb: 80,
        so: 700,
        wins: null,
        losses: null,
        era: null,
        whip: null,
        saves: null,
        innings_pitched: null,
      },
    ]);
  });

  it("ignores non-career groups", () => {
    const groups: MlbStatGroup[] = [
      {
        group: { displayName: "hitting" },
        type: { displayName: "season" },
        splits: [{ season: "2025", team: { id: 1 }, stat: { gamesPlayed: 100 } }],
      },
    ];
    expect(mapCareerStats(1, groups)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認**

```bash
npm test -- tests/lib/mlb-api/transform.test.ts
```

Expected: FAIL(`mapSeasonStats`/`mapCareerStats` が存在しない)

- [ ] **Step 3: 実装を追加**

`src/lib/mlb-api/transform.ts` に追記(importに `MlbStatGroup` と `SeasonStatRow`, `CareerStatRow`, `StatFields`, `StatType` を追加):

```typescript
import type { MlbPerson, MlbTeam, MlbTeamRecord, MlbStatGroup } from "./types";
import type {
  PlayerRow,
  TeamRow,
  StandingRow,
  SeasonStatRow,
  CareerStatRow,
  StatFields,
  StatType,
} from "../db/types";

// ...(既存の mapPlayer, mapTeam, mapStanding はそのまま)

function statTypeFromGroup(group: MlbStatGroup): StatType {
  return group.group.displayName === "pitching" ? "pitching" : "hitting";
}

function toNum(v: string | number | undefined): number | null {
  if (v === undefined || v === "-") return null;
  return typeof v === "number" ? v : parseFloat(v);
}

function toInt(v: string | number | undefined): number | null {
  if (v === undefined || v === "-") return null;
  return typeof v === "number" ? Math.trunc(v) : parseInt(v, 10);
}

function extractStatFields(
  statType: StatType,
  stat: Record<string, string | number | undefined>
): StatFields {
  const games = toInt(stat.gamesPlayed);

  if (statType === "hitting") {
    return {
      games,
      avg: toNum(stat.avg),
      hr: toInt(stat.homeRuns),
      rbi: toInt(stat.rbi),
      obp: toNum(stat.obp),
      slg: toNum(stat.slg),
      ops: toNum(stat.ops),
      sb: toInt(stat.stolenBases),
      so: toInt(stat.strikeOuts),
      wins: null,
      losses: null,
      era: null,
      whip: null,
      saves: null,
      innings_pitched: null,
    };
  }

  return {
    games,
    avg: null,
    hr: null,
    rbi: null,
    obp: null,
    slg: null,
    ops: null,
    sb: null,
    so: toInt(stat.strikeOuts),
    wins: toInt(stat.wins),
    losses: toInt(stat.losses),
    era: toNum(stat.era),
    whip: toNum(stat.whip),
    saves: toInt(stat.saves),
    innings_pitched: toNum(stat.inningsPitched),
  };
}

export function mapSeasonStats(playerId: number, groups: MlbStatGroup[]): SeasonStatRow[] {
  const rows: SeasonStatRow[] = [];
  for (const group of groups) {
    const typeName = group.type.displayName;
    if (typeName !== "season" && typeName !== "yearByYear") continue;
    const statType = statTypeFromGroup(group);
    for (const split of group.splits) {
      if (!split.season || !split.team) continue;
      rows.push({
        player_id: playerId,
        season: parseInt(split.season, 10),
        stat_type: statType,
        team_id: split.team.id,
        ...extractStatFields(statType, split.stat),
      });
    }
  }
  return rows;
}

export function mapCareerStats(playerId: number, groups: MlbStatGroup[]): CareerStatRow[] {
  const rows: CareerStatRow[] = [];
  for (const group of groups) {
    if (group.type.displayName !== "career") continue;
    const statType = statTypeFromGroup(group);
    const split = group.splits[0];
    if (!split) continue;
    rows.push({
      player_id: playerId,
      stat_type: statType,
      ...extractStatFields(statType, split.stat),
    });
  }
  return rows;
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

```bash
npm test -- tests/lib/mlb-api/transform.test.ts
```

Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/mlb-api/transform.ts tests/lib/mlb-api/transform.test.ts
git commit -m "feat: add season/career stats transform functions"
```

---

## Task 9: 並行実行ヘルパー

**Files:**
- Create: `src/lib/concurrency.ts`
- Test: `tests/lib/concurrency.test.ts`

**Interfaces:**
- Produces: `mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]>`

日次バッチは現役選手(750〜1200人規模)全員の成績をMLB APIから取得する必要があるが、Vercel Hobbyのサーバーレス関数実行時間には上限がある(Task 15で `maxDuration = 60` を設定)。逐次実行では間に合わないため、並列度を制限した並行処理ヘルパーを用意する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/lib/concurrency.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "@/lib/concurrency";

describe("mapWithConcurrency", () => {
  it("processes all items and preserves order", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, 2, async (n) => n * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it("never runs more than `concurrency` tasks at once", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return n;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認**

```bash
npm test -- tests/lib/concurrency.test.ts
```

Expected: FAIL(`concurrency.ts` が存在しない)

- [ ] **Step 3: 実装を書く**

`src/lib/concurrency.ts`:

```typescript
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
```

- [ ] **Step 4: テストを実行して通ることを確認**

```bash
npm test -- tests/lib/concurrency.test.ts
```

Expected: 全テストPASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/concurrency.ts tests/lib/concurrency.test.ts
git commit -m "feat: add bounded-concurrency map helper"
```

---

## Task 10: DB層 — 選手リポジトリ

**Files:**
- Create: `src/lib/db/players.ts`

**Interfaces:**
- Consumes: `createSupabaseClient`, `createSupabaseAdminClient`(Task 3)、`PlayerRow`, `SeasonStatRow`, `CareerStatRow`(Task 7)
- Produces: `searchPlayers(query: string, limit?: number): Promise<PlayerRow[]>`, `getPlayerById(id: number): Promise<PlayerRow | null>`, `upsertPlayers(players: PlayerRow[]): Promise<void>`, `markPlayerHistorySynced(id: number): Promise<void>`, `getSeasonStatsForPlayer(playerId: number): Promise<SeasonStatRow[]>`, `upsertSeasonStats(rows: SeasonStatRow[]): Promise<void>`, `getCareerStatsForPlayer(playerId: number): Promise<CareerStatRow[]>`, `upsertCareerStats(rows: CareerStatRow[]): Promise<void>`

このタスクはSupabaseへの実際のネットワーク呼び出しを行うため、モックによるユニットテストは設けない(Global Constraintsの方針どおり)。Task 14の一括インポートスクリプトを実際に動かすことで動作確認する。

- [ ] **Step 1: 実装を書く**

`src/lib/db/players.ts`:

```typescript
import { createSupabaseClient } from "../supabase/client";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { PlayerRow, SeasonStatRow, CareerStatRow } from "./types";

export async function searchPlayers(query: string, limit = 20): Promise<PlayerRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .ilike("full_name", `%${query}%`)
    .order("is_active", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getPlayerById(id: number): Promise<PlayerRow | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertPlayers(players: PlayerRow[]): Promise<void> {
  if (players.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("players").upsert(players, { onConflict: "id" });
  if (error) throw error;
}

export async function markPlayerHistorySynced(id: number): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("players").update({ history_synced: true }).eq("id", id);
  if (error) throw error;
}

export async function getSeasonStatsForPlayer(playerId: number): Promise<SeasonStatRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("season_stats")
    .select("*")
    .eq("player_id", playerId)
    .order("season", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertSeasonStats(rows: SeasonStatRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("season_stats")
    .upsert(rows, { onConflict: "player_id,season,stat_type,team_id" });
  if (error) throw error;
}

export async function getCareerStatsForPlayer(playerId: number): Promise<CareerStatRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("career_stats")
    .select("*")
    .eq("player_id", playerId);
  if (error) throw error;
  return data ?? [];
}

export async function upsertCareerStats(rows: CareerStatRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("career_stats")
    .upsert(rows, { onConflict: "player_id,stat_type" });
  if (error) throw error;
}
```

- [ ] **Step 2: 型チェックを実行**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/db/players.ts
git commit -m "feat: add player repository functions"
```

---

## Task 11: DB層 — チームリポジトリ

**Files:**
- Create: `src/lib/db/teams.ts`

**Interfaces:**
- Consumes: `createSupabaseClient`, `createSupabaseAdminClient`(Task 3)、`TeamRow`(Task 7)
- Produces: `getTeams(): Promise<TeamRow[]>`, `getTeamById(id: number): Promise<TeamRow | null>`, `upsertTeams(teams: TeamRow[]): Promise<void>`, `getTeamRoster(teamId: number, season: number): Promise<TeamRosterRow[]>`, 型 `TeamRosterRow`

- [ ] **Step 1: 実装を書く**

`src/lib/db/teams.ts`:

```typescript
import { createSupabaseClient } from "../supabase/client";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { TeamRow } from "./types";

export interface TeamRosterRow {
  player_id: number;
  stat_type: "hitting" | "pitching";
  avg: number | null;
  hr: number | null;
  era: number | null;
  wins: number | null;
  players: { full_name: string } | null;
}

export async function getTeams(): Promise<TeamRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("teams").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getTeamById(id: number): Promise<TeamRow | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("teams").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertTeams(teams: TeamRow[]): Promise<void> {
  if (teams.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("teams").upsert(teams, { onConflict: "id" });
  if (error) throw error;
}

export async function getTeamRoster(teamId: number, season: number): Promise<TeamRosterRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("season_stats")
    .select("player_id, stat_type, avg, hr, era, wins, players(full_name)")
    .eq("team_id", teamId)
    .eq("season", season);
  if (error) throw error;
  return (data ?? []) as unknown as TeamRosterRow[];
}
```

- [ ] **Step 2: 型チェックを実行**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/db/teams.ts
git commit -m "feat: add team repository functions"
```

---

## Task 12: DB層 — 順位表・リーダーボードリポジトリ

**Files:**
- Create: `src/lib/db/standings.ts`
- Create: `src/lib/db/leaders.ts`

**Interfaces:**
- Consumes: `createSupabaseClient`, `createSupabaseAdminClient`(Task 3)、`StandingRow`(Task 7)
- Produces: `getStandings(season: number): Promise<StandingRow[]>`, `upsertStandings(rows: StandingRow[]): Promise<void>`, `getLeaders(season: number, stat: LeaderStat, limit?: number): Promise<LeaderRow[]>`, 型 `LeaderStat`, `LeaderRow`

- [ ] **Step 1: 順位表リポジトリを書く**

`src/lib/db/standings.ts`:

```typescript
import { createSupabaseClient } from "../supabase/client";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { StandingRow } from "./types";

export async function getStandings(season: number): Promise<StandingRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("team_standings")
    .select("*")
    .eq("season", season)
    .order("division_rank", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertStandings(rows: StandingRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("team_standings")
    .upsert(rows, { onConflict: "team_id,season" });
  if (error) throw error;
}
```

- [ ] **Step 2: リーダーボードリポジトリを書く**

`src/lib/db/leaders.ts`:

```typescript
import { createSupabaseClient } from "../supabase/client";

const HITTING_STATS = ["avg", "hr", "rbi", "obp", "slg", "sb"] as const;
const PITCHING_STATS = ["era", "wins", "so", "saves", "whip"] as const;
export type LeaderStat = (typeof HITTING_STATS)[number] | (typeof PITCHING_STATS)[number];

const ASCENDING_STATS = new Set<string>(["era", "whip"]);

export interface LeaderRow {
  player_id: number;
  full_name: string;
  [stat: string]: unknown;
}

export async function getLeaders(
  season: number,
  stat: LeaderStat,
  limit = 25
): Promise<LeaderRow[]> {
  const supabase = createSupabaseClient();
  const statType = (PITCHING_STATS as readonly string[]).includes(stat) ? "pitching" : "hitting";
  const ascending = ASCENDING_STATS.has(stat);

  const { data, error } = await supabase
    .from("season_stats")
    .select(`*, players(full_name)`)
    .eq("season", season)
    .eq("stat_type", statType)
    .not(stat, "is", null)
    .order(stat, { ascending })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    full_name: (row.players as { full_name?: string } | null)?.full_name ?? "",
  })) as LeaderRow[];
}
```

- [ ] **Step 3: 型チェックを実行**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/lib/db/standings.ts src/lib/db/leaders.ts
git commit -m "feat: add standings and leaderboard repository functions"
```

---

## Task 13: 選手成績のオンデマンド取得サービス

**Files:**
- Create: `src/lib/player-stats-service.ts`

**Interfaces:**
- Consumes: `fetchPlayerStats`(Task 6)、`mapSeasonStats`, `mapCareerStats`(Task 8)、`getPlayerById`, `getSeasonStatsForPlayer`, `getCareerStatsForPlayer`, `upsertSeasonStats`, `upsertCareerStats`, `markPlayerHistorySynced`(Task 10)
- Produces: `getOrFetchPlayerStats(playerId: number): Promise<{ seasonStats: SeasonStatRow[]; careerStats: CareerStatRow[] }>`

選手の `history_synced` フラグが `false` の場合のみMLB APIから年度別成績(`yearByYear`)と通算成績(`career`)を取得してキャッシュし、フラグを立てる。一度 `true` になった選手(現役・引退問わず)は以後DBキャッシュのみで応答する。現役選手の「今シーズン」の値はTask 15の日次バッチが別途 `season_stats` を洗い替えるため鮮度が保たれる。

- [ ] **Step 1: 実装を書く**

`src/lib/player-stats-service.ts`:

```typescript
import { fetchPlayerStats } from "./mlb-api/client";
import { mapSeasonStats, mapCareerStats } from "./mlb-api/transform";
import {
  getPlayerById,
  getSeasonStatsForPlayer,
  getCareerStatsForPlayer,
  upsertSeasonStats,
  upsertCareerStats,
  markPlayerHistorySynced,
} from "./db/players";
import type { SeasonStatRow, CareerStatRow } from "./db/types";

export async function getOrFetchPlayerStats(
  playerId: number
): Promise<{ seasonStats: SeasonStatRow[]; careerStats: CareerStatRow[] }> {
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  if (!player.history_synced) {
    const groups = await fetchPlayerStats(playerId, "yearByYear,career");
    await upsertSeasonStats(mapSeasonStats(playerId, groups));
    await upsertCareerStats(mapCareerStats(playerId, groups));
    await markPlayerHistorySynced(playerId);
  }

  const [seasonStats, careerStats] = await Promise.all([
    getSeasonStatsForPlayer(playerId),
    getCareerStatsForPlayer(playerId),
  ]);

  return { seasonStats, careerStats };
}
```

- [ ] **Step 2: 型チェックを実行**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/player-stats-service.ts
git commit -m "feat: add on-demand player stats fetch-and-cache service"
```

---

## Task 14: 初回一括インポートスクリプト

**Files:**
- Create: `scripts/import-all-players.ts`
- Modify: `package.json`(scriptを追加)

**Interfaces:**
- Consumes: `fetchPlayersBySeason`, `fetchTeams`(Task 5)、`mapPlayer`, `mapTeam`(Task 7)、`upsertPlayers`(Task 10)、`upsertTeams`(Task 11)

- [ ] **Step 1: tsxをインストール(スクリプト実行用)**

```bash
npm install -D tsx dotenv
```

- [ ] **Step 2: スクリプトを書く**

`scripts/import-all-players.ts`:

```typescript
import "dotenv/config";
import { fetchPlayersBySeason, fetchTeams } from "../src/lib/mlb-api/client";
import { mapPlayer, mapTeam } from "../src/lib/mlb-api/transform";
import { upsertPlayers } from "../src/lib/db/players";
import { upsertTeams } from "../src/lib/db/teams";

const FIRST_SEASON = 1876;
const CURRENT_SEASON = new Date().getFullYear();
const BATCH_SIZE = 500;

async function main() {
  const teams = await fetchTeams(CURRENT_SEASON);
  await upsertTeams(teams.map(mapTeam));
  console.log(`Imported ${teams.length} teams`);

  const playersById = new Map<number, ReturnType<typeof mapPlayer>>();
  for (let season = FIRST_SEASON; season <= CURRENT_SEASON; season++) {
    try {
      const players = await fetchPlayersBySeason(season);
      for (const p of players) {
        playersById.set(p.id, mapPlayer(p));
      }
      console.log(`Season ${season}: ${players.length} players (unique so far: ${playersById.size})`);
    } catch (err) {
      console.error(`Failed to fetch season ${season}:`, err);
    }
  }

  const allPlayers = Array.from(playersById.values());
  for (let i = 0; i < allPlayers.length; i += BATCH_SIZE) {
    const batch = allPlayers.slice(i, i + BATCH_SIZE);
    await upsertPlayers(batch);
    console.log(`Upserted ${Math.min(i + BATCH_SIZE, allPlayers.length)}/${allPlayers.length} players`);
  }

  console.log("Initial import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: package.jsonにscriptを追加**

`package.json` の `"scripts"` に追加:

```json
"import:players": "tsx scripts/import-all-players.ts"
```

- [ ] **Step 4: `.env.local` を用意した上でスクリプトを実行する**

Task 3で作成した `.env.local` に実際のSupabase・MLB APIに必要な値が入っていることを確認してから実行(1876年から現在まで約150リクエストを送るため数分かかる):

```bash
npm run import:players
```

- [ ] **Step 5: 結果を確認する**

コンソールログで `Initial import complete.` が表示されることを確認し、SupabaseのTable Editorで `players` テーブルに数万件規模の行が入っていること、`teams` テーブルに30件前後入っていることを確認する。

- [ ] **Step 6: コミット**

```bash
git add package.json package-lock.json scripts/import-all-players.ts
git commit -m "feat: add initial bulk player/team import script"
```

---

## Task 15: 日次バッチAPIルート + Vercel Cron設定

**Files:**
- Create: `src/app/api/cron/daily-sync/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `fetchPlayersBySeason`, `fetchTeams`, `fetchStandings`, `fetchPlayerStats`(Task 5, 6)、`mapPlayer`, `mapTeam`, `mapStanding`, `mapSeasonStats`, `mapCareerStats`(Task 7, 8)、`mapWithConcurrency`(Task 9)、`upsertPlayers`, `upsertSeasonStats`, `upsertCareerStats`(Task 10)、`upsertTeams`(Task 11)、`upsertStandings`(Task 12)

- [ ] **Step 1: APIルートを書く**

`src/app/api/cron/daily-sync/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { fetchPlayersBySeason, fetchTeams, fetchStandings, fetchPlayerStats } from "@/lib/mlb-api/client";
import { mapPlayer, mapTeam, mapStanding, mapSeasonStats, mapCareerStats } from "@/lib/mlb-api/transform";
import { upsertPlayers, upsertSeasonStats, upsertCareerStats } from "@/lib/db/players";
import { upsertTeams } from "@/lib/db/teams";
import { upsertStandings } from "@/lib/db/standings";
import { mapWithConcurrency } from "@/lib/concurrency";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const season = new Date().getFullYear();

  const teams = await fetchTeams(season);
  await upsertTeams(teams.map(mapTeam));

  const standings = await fetchStandings(season);
  await upsertStandings(standings.map((r) => mapStanding(r, season)));

  const activePlayers = await fetchPlayersBySeason(season);
  await upsertPlayers(activePlayers.map(mapPlayer));

  const results = await mapWithConcurrency(activePlayers, 25, async (person) => {
    try {
      const groups = await fetchPlayerStats(person.id, "season,career", season);
      await upsertSeasonStats(mapSeasonStats(person.id, groups));
      await upsertCareerStats(mapCareerStats(person.id, groups));
      return true;
    } catch (err) {
      console.error(`Failed to sync stats for player ${person.id}:`, err);
      return false;
    }
  });
  const statsSynced = results.filter(Boolean).length;

  return NextResponse.json({
    ok: true,
    teams: teams.length,
    standings: standings.length,
    players: activePlayers.length,
    statsSynced,
  });
}
```

- [ ] **Step 2: Vercel Cron設定を書く**

`vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-sync",
      "schedule": "0 13 * * *"
    }
  ]
}
```

`0 13 * * *` はUTC 13:00(日本時間22:00)。西海岸のナイトゲームも含めてその日のMLB全試合が終わっている時間帯として設定している。

- [ ] **Step 3: 開発サーバーでルートを手動実行して確認する**

```bash
npm run dev
```

別ターミナルで(`.env.local` の `CRON_SECRET` を実際の値に置き換えて):

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/daily-sync
```

Expected: `{"ok":true,...}` のJSONが返り、SupabaseのTable Editorで `season_stats` / `career_stats` / `team_standings` にデータが入っていることを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/app/api/cron/daily-sync/route.ts vercel.json
git commit -m "feat: add daily sync cron route"
```

---

## Task 16: 選手検索APIルート

**Files:**
- Create: `src/app/api/players/search/route.ts`

**Interfaces:**
- Consumes: `searchPlayers`(Task 10)
- Produces: `GET /api/players/search?q=...` → `{ players: { id: number; full_name: string }[] }`(Task 22のクライアントコンポーネントが使用)

- [ ] **Step 1: APIルートを書く**

`src/app/api/players/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { searchPlayers } from "@/lib/db/players";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 2) {
    return NextResponse.json({ players: [] });
  }
  const players = await searchPlayers(q, 10);
  return NextResponse.json({
    players: players.map((p) => ({ id: p.id, full_name: p.full_name })),
  });
}
```

- [ ] **Step 2: 開発サーバーで手動確認する**

```bash
npm run dev
```

別ターミナルで:

```bash
curl "http://localhost:3000/api/players/search?q=Ohtani"
```

Expected: `{"players":[...]}` が返る(Task 14のインポートが完了している前提)

- [ ] **Step 3: コミット**

```bash
git add src/app/api/players/search/route.ts
git commit -m "feat: add player search API route"
```

---

## Task 17: トップページ

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `getLeaders`(Task 12)、`getStandings`(Task 12)、`getTeams`(Task 11)

- [ ] **Step 1: トップページを実装する**

`src/app/page.tsx`(既存の`create-next-app`生成内容を置き換える):

```tsx
import Link from "next/link";
import { getLeaders } from "@/lib/db/leaders";
import { getStandings } from "@/lib/db/standings";
import { getTeams } from "@/lib/db/teams";

export const revalidate = 3600;

export default async function HomePage() {
  const season = new Date().getFullYear();
  const [hrLeaders, avgLeaders, standings, teams] = await Promise.all([
    getLeaders(season, "hr", 5),
    getLeaders(season, "avg", 5),
    getStandings(season),
    getTeams(),
  ]);
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">MLB Stats</h1>

      <section>
        <h2 className="text-lg font-semibold mb-2">本塁打リーダー ({season})</h2>
        <ol className="list-decimal list-inside">
          {hrLeaders.map((row) => (
            <li key={row.player_id}>
              <Link href={`/players/${row.player_id}`} className="text-blue-600 hover:underline">
                {row.full_name}
              </Link>{" "}
              — {String(row.hr)}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">打率リーダー ({season})</h2>
        <ol className="list-decimal list-inside">
          {avgLeaders.map((row) => (
            <li key={row.player_id}>
              <Link href={`/players/${row.player_id}`} className="text-blue-600 hover:underline">
                {row.full_name}
              </Link>{" "}
              — {String(row.avg)}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">チーム順位 ({season})</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>チーム</th>
              <th>勝</th>
              <th>敗</th>
              <th>勝率</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.team_id}>
                <td>
                  <Link href={`/teams/${s.team_id}`} className="text-blue-600 hover:underline">
                    {teamNameById.get(s.team_id) ?? s.team_id}
                  </Link>
                </td>
                <td>{s.wins}</td>
                <td>{s.losses}</td>
                <td>{s.win_pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: ブラウザで確認する**

```bash
npm run dev
```

`http://localhost:3000` を開き、リーダーボードとチーム順位が表示されることを確認する(Task 15の日次バッチが最低1回実行済みであること)。

- [ ] **Step 3: コミット**

```bash
git add src/app/page.tsx
git commit -m "feat: build home page with leaders and standings highlights"
```

---

## Task 18: 選手検索ページ

**Files:**
- Create: `src/app/players/page.tsx`

**Interfaces:**
- Consumes: `searchPlayers`(Task 10)

- [ ] **Step 1: ページを実装する**

`src/app/players/page.tsx`:

```tsx
import Link from "next/link";
import { searchPlayers } from "@/lib/db/players";

export default async function PlayersSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const players = q ? await searchPlayers(q) : [];

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">選手検索</h1>
      <form className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="選手名で検索"
          className="border px-3 py-2 w-full"
        />
      </form>
      {q && players.length === 0 && <p>「{q}」に一致する選手が見つかりませんでした。</p>}
      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.id}>
            <Link href={`/players/${p.id}`} className="text-blue-600 hover:underline">
              {p.full_name}
            </Link>
            {!p.is_active && <span className="text-gray-400 text-sm ml-2">(引退)</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: ブラウザで確認する**

`http://localhost:3000/players?q=Ohtani` を開き、検索結果が表示されることを確認する。`http://localhost:3000/players?q=zzzzz` で「見つかりませんでした」が表示されることも確認する。

- [ ] **Step 3: コミット**

```bash
git add src/app/players/page.tsx
git commit -m "feat: build player search page"
```

---

## Task 19: 選手詳細ページ

**Files:**
- Create: `src/app/players/[id]/page.tsx`
- Create: `src/components/StatsTable.tsx`

**Interfaces:**
- Consumes: `getPlayerById`(Task 10)、`getOrFetchPlayerStats`(Task 13)

- [ ] **Step 1: StatsTableコンポーネントを実装する**

`src/components/StatsTable.tsx`:

```tsx
import type { SeasonStatRow, CareerStatRow, StatType } from "@/lib/db/types";

const HITTING_COLUMNS: { key: string; label: string }[] = [
  { key: "games", label: "試合" },
  { key: "avg", label: "打率" },
  { key: "hr", label: "本塁打" },
  { key: "rbi", label: "打点" },
  { key: "obp", label: "出塁率" },
  { key: "slg", label: "長打率" },
];

const PITCHING_COLUMNS: { key: string; label: string }[] = [
  { key: "games", label: "登板" },
  { key: "wins", label: "勝利" },
  { key: "losses", label: "敗戦" },
  { key: "era", label: "防御率" },
  { key: "so", label: "奪三振" },
  { key: "whip", label: "WHIP" },
];

export default function StatsTable({
  rows,
  statType,
  showSeason = false,
}: {
  rows: (SeasonStatRow | CareerStatRow)[];
  statType: StatType;
  showSeason?: boolean;
}) {
  const filtered = rows.filter((r) => r.stat_type === statType);
  if (filtered.length === 0) return null;

  const columns = statType === "hitting" ? HITTING_COLUMNS : PITCHING_COLUMNS;

  return (
    <table className="w-full text-left text-sm mb-4">
      <thead>
        <tr>
          {showSeason && <th>年度</th>}
          {columns.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filtered.map((row, i) => (
          <tr key={i}>
            {showSeason && "season" in row && <td>{row.season}</td>}
            {columns.map((c) => (
              <td key={c.key}>{String((row as Record<string, unknown>)[c.key] ?? "-")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: ページを実装する**

`src/app/players/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getPlayerById } from "@/lib/db/players";
import { getOrFetchPlayerStats } from "@/lib/player-stats-service";
import StatsTable from "@/components/StatsTable";
import type { SeasonStatRow, CareerStatRow } from "@/lib/db/types";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = parseInt(id, 10);
  const player = await getPlayerById(playerId);
  if (!player) notFound();

  let seasonStats: SeasonStatRow[] = [];
  let careerStats: CareerStatRow[] = [];
  let fetchError = false;
  try {
    const stats = await getOrFetchPlayerStats(playerId);
    seasonStats = stats.seasonStats;
    careerStats = stats.careerStats;
  } catch {
    fetchError = true;
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{player.full_name}</h1>
      <p className="text-gray-500">
        {player.primary_position} {player.is_active ? "(現役)" : "(引退)"}
      </p>

      {fetchError && <p className="text-red-500">成績を取得できませんでした。</p>}

      {!fetchError && (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-2">通算成績</h2>
            <StatsTable rows={careerStats} statType="hitting" />
            <StatsTable rows={careerStats} statType="pitching" />
          </section>
          <section>
            <h2 className="text-lg font-semibold mb-2">年度別成績</h2>
            <StatsTable rows={seasonStats} statType="hitting" showSeason />
            <StatsTable rows={seasonStats} statType="pitching" showSeason />
          </section>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: ブラウザで確認する**

選手検索ページから任意の選手をクリックし、通算成績・年度別成績が表示されることを確認する。存在しないID(例: `http://localhost:3000/players/999999999`)で404になることも確認する。

- [ ] **Step 4: コミット**

```bash
git add src/app/players/[id]/page.tsx src/components/StatsTable.tsx
git commit -m "feat: build player detail page"
```

---

## Task 20: リーダーボードページ

**Files:**
- Create: `src/app/leaders/page.tsx`

**Interfaces:**
- Consumes: `getLeaders`, `LeaderStat`(Task 12)

- [ ] **Step 1: ページを実装する**

`src/app/leaders/page.tsx`:

```tsx
import Link from "next/link";
import { getLeaders, type LeaderStat } from "@/lib/db/leaders";

const STAT_OPTIONS: { value: LeaderStat; label: string }[] = [
  { value: "avg", label: "打率" },
  { value: "hr", label: "本塁打" },
  { value: "rbi", label: "打点" },
  { value: "era", label: "防御率" },
  { value: "wins", label: "勝利" },
  { value: "so", label: "奪三振" },
];

export default async function LeadersPage({
  searchParams,
}: {
  searchParams: Promise<{ stat?: string; season?: string }>;
}) {
  const params = await searchParams;
  const season = params.season ? parseInt(params.season, 10) : new Date().getFullYear();
  const stat = (params.stat ?? "avg") as LeaderStat;
  const leaders = await getLeaders(season, stat);

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">リーダーボード ({season})</h1>
      <nav className="flex gap-3 mb-4 flex-wrap">
        {STAT_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/leaders?stat=${opt.value}&season=${season}`}
            className={opt.value === stat ? "font-bold underline" : "text-blue-600"}
          >
            {opt.label}
          </Link>
        ))}
      </nav>
      <ol className="list-decimal list-inside space-y-1">
        {leaders.map((row) => (
          <li key={row.player_id}>
            <Link href={`/players/${row.player_id}`} className="hover:underline">
              {row.full_name}
            </Link>{" "}
            — {String(row[stat])}
          </li>
        ))}
      </ol>
    </main>
  );
}
```

- [ ] **Step 2: ブラウザで確認する**

`http://localhost:3000/leaders` を開き、デフォルトで打率リーダーが表示されること、上部のナビゲーションで指標を切り替えられることを確認する。

- [ ] **Step 3: コミット**

```bash
git add src/app/leaders/page.tsx
git commit -m "feat: build leaderboard page"
```

---

## Task 21: チームページ(一覧・詳細)

**Files:**
- Create: `src/app/teams/page.tsx`
- Create: `src/app/teams/[id]/page.tsx`

**Interfaces:**
- Consumes: `getStandings`(Task 12)、`getTeams`, `getTeamById`, `getTeamRoster`(Task 11)

- [ ] **Step 1: チーム一覧ページを実装する**

`src/app/teams/page.tsx`:

```tsx
import Link from "next/link";
import { getStandings } from "@/lib/db/standings";
import { getTeams } from "@/lib/db/teams";
import type { StandingRow } from "@/lib/db/types";

export default async function TeamsPage() {
  const season = new Date().getFullYear();
  const [standings, teams] = await Promise.all([getStandings(season), getTeams()]);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const byDivision = new Map<string, StandingRow[]>();
  for (const s of standings) {
    const team = teamById.get(s.team_id);
    const key = `${team?.league ?? "?"} - ${team?.division ?? "?"}`;
    if (!byDivision.has(key)) byDivision.set(key, []);
    byDivision.get(key)!.push(s);
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">チーム順位表 ({season})</h1>
      {Array.from(byDivision.entries()).map(([division, rows]) => (
        <section key={division}>
          <h2 className="text-lg font-semibold mb-2">{division}</h2>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>チーム</th>
                <th>勝</th>
                <th>敗</th>
                <th>勝率</th>
                <th>差</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.team_id}>
                  <td>
                    <Link href={`/teams/${s.team_id}`} className="text-blue-600 hover:underline">
                      {teamById.get(s.team_id)?.name ?? s.team_id}
                    </Link>
                  </td>
                  <td>{s.wins}</td>
                  <td>{s.losses}</td>
                  <td>{s.win_pct}</td>
                  <td>{s.games_back}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: チーム詳細ページを実装する**

`src/app/teams/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamById, getTeamRoster } from "@/lib/db/teams";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = parseInt(id, 10);
  const team = await getTeamById(teamId);
  if (!team) notFound();

  const season = new Date().getFullYear();
  const roster = await getTeamRoster(teamId, season);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{team.name}</h1>
      <ul className="space-y-1">
        {roster.map((r) => (
          <li key={`${r.player_id}-${r.stat_type}`}>
            <Link href={`/players/${r.player_id}`} className="text-blue-600 hover:underline">
              {r.players?.full_name ?? r.player_id}
            </Link>{" "}
            {r.stat_type === "hitting" ? `打率 ${r.avg ?? "-"}` : `防御率 ${r.era ?? "-"}`}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: ブラウザで確認する**

`http://localhost:3000/teams` を開きリーグ・地区別の順位表が表示されること、チーム名クリックで `http://localhost:3000/teams/[id]` に遷移し所属選手一覧が表示されることを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/app/teams/page.tsx "src/app/teams/[id]/page.tsx"
git commit -m "feat: build team standings and team detail pages"
```

---

## Task 22: 選手比較ページ

**Files:**
- Create: `src/app/compare/page.tsx`
- Create: `src/components/ComparePicker.tsx`

**Interfaces:**
- Consumes: `getPlayerById`, `getCareerStatsForPlayer`(Task 10)、`GET /api/players/search`(Task 16)

- [ ] **Step 1: ComparePickerクライアントコンポーネントを実装する**

`src/components/ComparePicker.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: number;
  full_name: string;
}

const MAX_PLAYERS = 5;

export default function ComparePicker({ selectedIds }: { selectedIds: number[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/players/search?q=${encodeURIComponent(value)}`);
    const data = await res.json();
    setResults(data.players ?? []);
  }

  function addPlayer(id: number) {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_PLAYERS) return;
    router.push(`/compare?players=${[...selectedIds, id].join(",")}`);
  }

  function removePlayer(id: number) {
    router.push(`/compare?players=${selectedIds.filter((existing) => existing !== id).join(",")}`);
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="選手を追加(2文字以上、最大5人)"
        className="border px-3 py-2 w-full"
      />
      {results.length > 0 && (
        <ul className="border mt-1">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => addPlayer(r.id)}
                className="px-3 py-1 hover:bg-gray-100 w-full text-left"
              >
                {r.full_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2 mt-2 flex-wrap">
        {selectedIds.map((id) => (
          <button key={id} onClick={() => removePlayer(id)} className="border px-2 py-1 text-sm">
            ID:{id} ✕
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ページを実装する**

`src/app/compare/page.tsx`:

```tsx
import { getPlayerById, getCareerStatsForPlayer } from "@/lib/db/players";
import ComparePicker from "@/components/ComparePicker";

const COMPARE_STATS = ["avg", "hr", "rbi", "obp", "slg", "era", "wins", "so"] as const;
const PITCHING_STATS = new Set(["era", "wins", "so"]);

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ players?: string }>;
}) {
  const { players: playersParam } = await searchParams;
  const ids = (playersParam ?? "")
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n))
    .slice(0, 5);

  const entries = await Promise.all(
    ids.map(async (id) => {
      const player = await getPlayerById(id);
      if (!player) return null;
      const stats = await getCareerStatsForPlayer(id);
      return { player, stats };
    })
  );
  const valid = entries.filter((e): e is NonNullable<typeof e> => e !== null);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">選手比較</h1>
      <ComparePicker selectedIds={ids} />
      {valid.length > 0 && (
        <table className="w-full text-left mt-6">
          <thead>
            <tr>
              <th>指標</th>
              {valid.map((v) => (
                <th key={v.player.id}>{v.player.full_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_STATS.map((stat) => {
              const statType = PITCHING_STATS.has(stat) ? "pitching" : "hitting";
              return (
                <tr key={stat}>
                  <td>{stat}</td>
                  {valid.map((v) => {
                    const row = v.stats.find((s) => s.stat_type === statType);
                    const value = row ? (row as Record<string, unknown>)[stat] : null;
                    return <td key={v.player.id}>{value === null || value === undefined ? "-" : String(value)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
```

- [ ] **Step 3: ブラウザで確認する**

`http://localhost:3000/compare` を開き、検索ボックスから選手を追加すると比較テーブルが表示されること、✕ボタンで選手を除外できることを確認する。

- [ ] **Step 4: コミット**

```bash
git add src/app/compare/page.tsx src/components/ComparePicker.tsx
git commit -m "feat: build player comparison page"
```

---

## デプロイ手順(全タスク完了後)

1. GitHubにリポジトリを作成しpush
2. Vercelダッシュボードでプロジェクトをインポート
3. 環境変数(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`)をVercelのProject Settings → Environment Variablesに設定
4. デプロイ後、本番URLで `npm run import:players` 相当の初回インポートを行う(ローカルから本番Supabaseに向けて実行するか、`/api/cron/daily-sync` とは別に一度だけ手動実行する)
5. Vercel Cronが `vercel.json` の設定どおりに登録されていることをVercelダッシュボードのCron Jobsタブで確認する

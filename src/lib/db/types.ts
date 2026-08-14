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
  division_rank: number | null;
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

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

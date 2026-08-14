import type { MlbPerson, MlbTeam, MlbTeamRecord, MlbStatGroup, MlbStatSplit } from "./types";
import type {
  PlayerRow,
  TeamRow,
  StandingRow,
  SeasonStatRow,
  CareerStatRow,
  StatFields,
  StatType,
} from "../db/types";

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
  // One malformed value must not fail the whole upsertStandings batch.
  const winPct = parseFloat(record.winningPercentage);
  const divisionRank = parseInt(record.divisionRank, 10);
  const gamesBack = record.gamesBack === "-" ? 0 : parseFloat(record.gamesBack);

  return {
    team_id: record.team.id,
    season,
    wins: record.wins,
    losses: record.losses,
    // win_pct is NOT NULL in the schema, so fall back to 0.
    win_pct: Number.isNaN(winPct) ? 0 : winPct,
    // division_rank is nullable, so an unparseable rank can stay null.
    division_rank: Number.isNaN(divisionRank) ? null : divisionRank,
    games_back: Number.isNaN(gamesBack) ? 0 : gamesBack,
    updated_at: new Date().toISOString(),
  };
}

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

    // Group this stat type's splits by season. For a traded player the MLB API
    // returns one split per team plus a combined split (no `team`) holding the
    // full-season totals; without grouping we would emit only the partial
    // per-team rows and double-count the player on leaderboards.
    const splitsBySeason = new Map<string, MlbStatSplit[]>();
    for (const split of group.splits) {
      if (!split.season) continue;
      const existing = splitsBySeason.get(split.season);
      if (existing) existing.push(split);
      else splitsBySeason.set(split.season, [split]);
    }

    for (const [season, splits] of splitsBySeason) {
      const combined = splits.find((s) => !s.team);
      const teamSplits = splits.filter((s) => s.team);

      if (combined) {
        const lastTeamSplit = teamSplits[teamSplits.length - 1];
        if (!lastTeamSplit?.team) {
          // Shouldn't happen with the real API shape, but a combined split has
          // no team id of its own and team_id is NOT NULL, so skip it.
          console.warn(
            `Skipping combined ${statType} split for player ${playerId} season ${season}: no per-team split to source a team_id from`
          );
          continue;
        }
        // The team the player finished the season with.
        rows.push({
          player_id: playerId,
          season: parseInt(season, 10),
          stat_type: statType,
          team_id: lastTeamSplit.team.id,
          ...extractStatFields(statType, combined.stat),
        });
        continue;
      }

      // No trade that season: emit each per-team split as-is.
      for (const split of teamSplits) {
        rows.push({
          player_id: playerId,
          season: parseInt(season, 10),
          stat_type: statType,
          team_id: split.team!.id,
          ...extractStatFields(statType, split.stat),
        });
      }
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

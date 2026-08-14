import { describe, it, expect } from "vitest";
import { mapPlayer, mapTeam, mapStanding, mapSeasonStats, mapCareerStats } from "@/lib/mlb-api/transform";
import type { MlbPerson, MlbTeam, MlbTeamRecord, MlbStatGroup } from "@/lib/mlb-api/types";

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

  it("falls back to safe defaults for unparseable rank and win pct", () => {
    const record: MlbTeamRecord = {
      team: { id: 121 },
      wins: 0,
      losses: 0,
      winningPercentage: "-",
      divisionRank: "-",
      gamesBack: "-",
    };
    const row = mapStanding(record, 2026);
    expect(row.win_pct).toBe(0);
    expect(row.division_rank).toBeNull();
    expect(row.games_back).toBe(0);
  });
});

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

  it("extracts pitching rows for a season with a single team", () => {
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
        ],
      },
    ];
    const rows = mapSeasonStats(660271, groups);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      stat_type: "pitching",
      team_id: 147,
      wins: 12,
      losses: 5,
      era: 3.2,
      whip: 1.05,
      saves: 0,
      innings_pitched: 150,
    });
  });

  it("uses the combined split for a traded season, tagged with the last team", () => {
    const groups: MlbStatGroup[] = [
      {
        group: { displayName: "hitting" },
        type: { displayName: "yearByYear" },
        splits: [
          {
            season: "2025",
            team: { id: 147 },
            stat: { gamesPlayed: 60, avg: ".250", homeRuns: 8, rbi: 25 },
          },
          {
            season: "2025",
            team: { id: 119 },
            stat: { gamesPlayed: 80, avg: ".300", homeRuns: 22, rbi: 65 },
          },
          {
            // Combined full-season totals across both teams (no team field).
            season: "2025",
            stat: { gamesPlayed: 140, avg: ".279", homeRuns: 30, rbi: 90 },
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
      // the team the player finished the season with
      team_id: 119,
      games: 140,
      avg: 0.279,
      hr: 30,
      rbi: 90,
    });
  });

  it("keeps separate rows per season and does not merge across seasons", () => {
    const groups: MlbStatGroup[] = [
      {
        group: { displayName: "hitting" },
        type: { displayName: "yearByYear" },
        splits: [
          { season: "2024", team: { id: 147 }, stat: { gamesPlayed: 150, homeRuns: 20 } },
          { season: "2025", team: { id: 119 }, stat: { gamesPlayed: 140, homeRuns: 30 } },
        ],
      },
    ];
    const rows = mapSeasonStats(660271, groups);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.season).sort()).toEqual([2024, 2025]);
  });

  it("skips a combined split that has no per-team split to source a team id from", () => {
    const groups: MlbStatGroup[] = [
      {
        group: { displayName: "hitting" },
        type: { displayName: "yearByYear" },
        splits: [{ season: "2025", stat: { gamesPlayed: 140, homeRuns: 30 } }],
      },
    ];
    expect(mapSeasonStats(660271, groups)).toHaveLength(0);
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

describe("mapSeasonStats and mapCareerStats together with mixed groups", () => {
  it("filters correctly when both yearByYear and career groups are in the same array", () => {
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

    // mapSeasonStats should return only the yearByYear row
    const seasonRows = mapSeasonStats(660271, groups);
    expect(seasonRows).toHaveLength(1);
    expect(seasonRows[0]).toMatchObject({
      player_id: 660271,
      season: 2025,
      stat_type: "hitting",
      team_id: 147,
      games: 150,
      avg: 0.285,
      hr: 30,
    });

    // mapCareerStats should return only the career row
    const careerRows = mapCareerStats(660271, groups);
    expect(careerRows).toHaveLength(1);
    expect(careerRows[0]).toMatchObject({
      player_id: 660271,
      stat_type: "hitting",
      games: 800,
      avg: 0.27,
      hr: 200,
    });
  });
});

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
